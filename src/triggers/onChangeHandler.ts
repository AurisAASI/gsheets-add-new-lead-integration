import {getConfig} from '../config/settings';
import {logError, logInfo, logWarn} from '../logging/logger';
import {
  appendRequestLog,
  isHistoryWriteInProgress,
} from '../logging/requestLog';
import {isRelevantChangeType} from '../sync/changeTypes';
import {
  processLastRow as processLastRowEngine,
  processPendingRows,
  ProcessSummary,
  reprocessUnsentRows,
} from '../sync/processPending';
import {
  buildQuietToken,
  QUIET_MAX_WAIT_MS,
  remainingQuietSleepMs,
  stillOwnsQuietToken,
} from '../sync/quietPeriod';
import {
  AUTH_WARN_CACHE_KEY,
  AUTH_WARN_TTL_SECONDS,
  HISTORY_SHEET_NAME,
  QUIET_TOKEN_CACHE_KEY,
  QUIET_TOKEN_TTL_SECONDS,
  RequestLogOrigin,
} from '../types';
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from '../ui/notifications';
import {ensureAuthorization} from './triggerManager';

function getDocumentCacheSafe(): GoogleAppsScript.Cache.Cache | null {
  try {
    return CacheService.getDocumentCache();
  } catch {
    return null;
  }
}

function resolveSpreadsheet(
    e?: GoogleAppsScript.Events.SheetsOnChange,
): GoogleAppsScript.Spreadsheet.Spreadsheet | null {
  if (e && e.source) {
    return e.source;
  }
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch {
    return null;
  }
}

function sleepMs(ms: number): void {
  if (ms <= 0) {
    return;
  }
  Utilities.sleep(ms);
}

function recordAuthRequiredOnce(
    spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | null,
): void {
  const cache = getDocumentCacheSafe();
  if (cache && cache.get(AUTH_WARN_CACHE_KEY)) {
    return;
  }
  if (cache) {
    cache.put(AUTH_WARN_CACHE_KEY, '1', AUTH_WARN_TTL_SECONDS);
  }
  appendRequestLog({
    origin: 'Automático',
    row: '',
    name: '',
    result: 'Erro',
    statusCode: '',
    message:
      'Reautorização necessária. Abra Extensões → Lead Control e autorize novamente.',
    endpoint: '',
  }, spreadsheet || undefined);
}

function formatBatchSummary(summary: ProcessSummary): string {
  return (
    `enviados=${summary.sent} | duplicados=${summary.duplicates} | ` +
    `ignorados=${summary.skipped} | erros=${summary.errors} | ` +
    `pendentes=${summary.pending} | settledThrough=${summary.processedUntil}`
  );
}

function notifySummary(summary: ProcessSummary, previousSettled: number): void {
  if (summary.authBlocked) {
    showErrorToast(
        'Credenciais recusadas pela API. Verifique a chave de API no painel.',
    );
    return;
  }
  if (summary.sent > 0) {
    showSuccessToast(`${summary.sent} lead(s) enviado(s) com sucesso.`);
  } else if (summary.errors > 0) {
    const firstError = summary.errorMessages[0] || 'erro desconhecido';
    showErrorToast(
        `${summary.errors} lead(s) com erro. Ex.: ${firstError}. ` +
        'Veja a aba Lead Control - Histórico.',
    );
  } else if (summary.skipped > 0 && summary.processedUntil > previousSettled) {
    showWarningToast(
        `${summary.skipped} linha(s) ignorada(s) por dados incompletos.`,
    );
  }
}

/**
 * Wait until quiet period owns this token, then process pending rows.
 */
function runQuietProcess(
    spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet,
    token: string,
): void {
  const startMs = Date.now();
  const cache = getDocumentCacheSafe();

  while (true) {
    const sleepFor = remainingQuietSleepMs(startMs, Date.now());
    if (sleepFor <= 0) {
      break;
    }
    sleepMs(sleepFor);
    const latest = cache ? cache.get(QUIET_TOKEN_CACHE_KEY) : token;
    if (!stillOwnsQuietToken(token, latest)) {
      logInfo('onChange', 'Token quieto substituído — execução cede o passe');
      return;
    }
    // Owned after one quiet wait → process
    break;
  }

  // Final ownership check after max wait path
  const latest = cache ? cache.get(QUIET_TOKEN_CACHE_KEY) : token;
  if (!stillOwnsQuietToken(token, latest)) {
    logInfo('onChange', 'Token quieto substituído no fim da espera — cede');
    return;
  }

  const config = getConfig();
  const previousSettled = config.settledThrough;
  const summary = processPendingRows(spreadsheet, 'Automático');
  logInfo('onChange', `Concluído | ${formatBatchSummary(summary)}`);
  notifySummary(summary, previousSettled);
}

export function processNewRows(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): ProcessSummary {
  return processPendingRows(spreadsheet, 'Automático');
}

export function processLastRow(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
    origin: RequestLogOrigin = 'Teste',
): {success: boolean; message: string; outcome?: 'created' | 'duplicate' | 'error'} {
  return processLastRowEngine(spreadsheet, origin);
}

export function onHourlySweep(): void {
  try {
    if (!ensureAuthorization()) {
      recordAuthRequiredOnce(resolveSpreadsheet());
      logWarn('onChange', 'Passe horário interrompido — reautorização necessária');
      return;
    }

    const config = getConfig();
    if (!config.enabled) {
      logInfo('onChange', 'Passe horário ignorado — integração desativada');
      return;
    }

    const spreadsheet = resolveSpreadsheet();
    if (!spreadsheet) {
      logWarn('onChange', 'Passe horário sem planilha disponível');
      return;
    }

    const summary = processPendingRows(spreadsheet, 'Automático');
    logInfo('onChange', `Passe horário | ${formatBatchSummary(summary)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('onChange', 'Exceção no passe horário', message);
    throw error;
  }
}

export function handleReprocessUnsent(): ProcessSummary {
  const spreadsheet = resolveSpreadsheet();
  return reprocessUnsentRows(spreadsheet || undefined);
}

export function onChangeHandler(e: GoogleAppsScript.Events.SheetsOnChange): void {
  try {
    const spreadsheet = resolveSpreadsheet(e);
    const config = getConfig();

    logInfo(
        'onChange',
        `Iniciado | changeType=${e.changeType} | enabled=${config.enabled} | ` +
        `aba=${config.sheetName}`,
    );

    if (!ensureAuthorization()) {
      recordAuthRequiredOnce(spreadsheet);
      return;
    }

    if (!config.enabled) {
      logInfo('onChange', 'Integração desativada — ignorado');
      return;
    }

    if (config.sheetName === HISTORY_SHEET_NAME) {
      logWarn('onChange', 'Aba de histórico não pode ser monitorada — ignorado');
      return;
    }

    if (!isRelevantChangeType(e.changeType)) {
      logInfo('onChange', `Tipo de alteração ignorado: ${e.changeType}`);
      return;
    }

    // History writes: still schedule a quiet pass for the source sheet,
    // but skip if we somehow have no spreadsheet handle.
    if (isHistoryWriteInProgress()) {
      logInfo(
          'onChange',
          'Escrita de histórico detectada — agenda passe quieto mesmo assim',
      );
    }

    if (!spreadsheet) {
      logError('onChange', 'Planilha do evento indisponível (e.source)');
      return;
    }

    const token = buildQuietToken(
        Date.now(),
        String(Math.floor(Math.random() * 1e9)),
    );
    const cache = getDocumentCacheSafe();
    if (cache) {
      cache.put(QUIET_TOKEN_CACHE_KEY, token, QUIET_TOKEN_TTL_SECONDS);
    }

    logInfo(
        'onChange',
        `Espera quieta iniciada | token=${token} | maxMs=${QUIET_MAX_WAIT_MS}`,
    );
    runQuietProcess(spreadsheet, token);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('onChange', 'Exceção não tratada', message);
    throw error;
  }
}
