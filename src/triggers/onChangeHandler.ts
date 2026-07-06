import {sendLeadToApi} from '../api/leadClient';
import {
  getConfig,
  getConfiguredSheet,
  setLastProcessedRow,
} from '../config/settings';
import {logError, logInfo, logWarn} from '../logging/logger';
import {
  formatMissingFields,
  getMissingRequiredFields,
  mapRowToLead,
  readRowData,
} from '../mapping/leadMapper';
import {DEBOUNCE_SECONDS, HEADER_ROW} from '../types';
import {
  showErrorToast,
  showSuccessToast,
  showWarningToast,
} from '../ui/notifications';
import {ensureAuthorizationOrNotify} from './triggerManager';

const RELEVANT_CHANGE_TYPES = new Set(['EDIT', 'INSERT_ROW']);
const MAX_ERROR_MESSAGES_IN_LOG = 3;

interface RowProcessResult {
  sent: number;
  skipped: number;
  errors: number;
  errorMessage?: string;
}

function getDebounceKey(): string {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return `lead-control:onChange:${ss.getId()}`;
}

function isDebounced(): boolean {
  const cache = CacheService.getDocumentCache();
  if (!cache) {
    return false;
  }
  const key = getDebounceKey();
  return cache.get(key) !== null;
}

function setDebounce(): void {
  const cache = CacheService.getDocumentCache();
  if (!cache) {
    return;
  }
  cache.put(getDebounceKey(), '1', DEBOUNCE_SECONDS);
}

function formatBatchSummary(
    sent: number,
    skipped: number,
    errors: number,
    processedUntil: number,
): string {
  return `enviados=${sent} | ignorados=${skipped} | erros=${errors} | atéLinha=${processedUntil}`;
}

function processRow(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    row: number,
): RowProcessResult {
  const config = getConfig();
  const rowInfo = readRowData(sheet, row);
  if (!rowInfo) {
    logWarn('onChange', `Linha ${row} ilegível ou vazia — ignorada`);
    return {sent: 0, skipped: 1, errors: 0};
  }

  const lead = mapRowToLead(rowInfo.headers, rowInfo.rowData, config);
  const missing = getMissingRequiredFields(lead);

  if (missing.length > 0) {
    logWarn(
        'onChange',
        `Linha ${row} ignorada | campos ausentes: ${missing.join(', ')}`,
    );
    return {sent: 0, skipped: 1, errors: 0};
  }

  const result = sendLeadToApi(lead, config, {row});
  if (result.success) {
    return {sent: 1, skipped: 0, errors: 0};
  }

  return {
    sent: 0,
    skipped: 0,
    errors: 1,
    errorMessage: `Linha ${row}: ${result.message}`,
  };
}

export function processNewRows(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): {
  sent: number;
  skipped: number;
  errors: number;
  processedUntil: number;
  errorMessages: string[];
} {
  const config = getConfig();
  if (!config.enabled) {
    return {
      sent: 0,
      skipped: 0,
      errors: 0,
      processedUntil: config.lastProcessedRow,
      errorMessages: [],
    };
  }

  const sheet = getConfiguredSheet(spreadsheet);
  if (!sheet) {
    logError('onChange', `Aba "${config.sheetName}" não encontrada`);
    return {
      sent: 0,
      skipped: 0,
      errors: 0,
      processedUntil: config.lastProcessedRow,
      errorMessages: [],
    };
  }

  const lastRow = sheet.getLastRow();
  const startRow = Math.max(config.lastProcessedRow + 1, HEADER_ROW + 1);

  if (lastRow < startRow) {
    logInfo('onChange', 'Nenhuma linha nova para processar');
    return {
      sent: 0,
      skipped: 0,
      errors: 0,
      processedUntil: config.lastProcessedRow,
      errorMessages: [],
    };
  }

  logInfo(
      'onChange',
      `Processando linhas | aba=${config.sheetName} | startRow=${startRow} | ` +
      `lastRow=${lastRow} | lastProcessedRow=${config.lastProcessedRow}`,
  );

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (let row = startRow; row <= lastRow; row++) {
    const result = processRow(sheet, row);
    sent += result.sent;
    skipped += result.skipped;
    errors += result.errors;
    if (result.errorMessage) {
      errorMessages.push(result.errorMessage);
    }
  }

  setLastProcessedRow(lastRow);

  logInfo(
      'onChange',
      `Lote concluído | ${formatBatchSummary(sent, skipped, errors, lastRow)}`,
  );

  if (errorMessages.length > 0) {
    const preview = errorMessages
        .slice(0, MAX_ERROR_MESSAGES_IN_LOG)
        .join('; ');
    const suffix = errorMessages.length > MAX_ERROR_MESSAGES_IN_LOG ?
      ` (+${errorMessages.length - MAX_ERROR_MESSAGES_IN_LOG} erro(s))` :
      '';
    logError('onChange', `Erros no lote | ${preview}${suffix}`);
  }

  return {sent, skipped, errors, processedUntil: lastRow, errorMessages};
}

export function processLastRow(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): {success: boolean; message: string} {
  const config = getConfig();
  const sheet = getConfiguredSheet(spreadsheet);

  if (!sheet) {
    const message = `Aba "${config.sheetName}" não encontrada.`;
    logError('onChange', message);
    return {success: false, message};
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) {
    const message = 'Não há linhas de dados para enviar.';
    logWarn('onChange', message);
    return {success: false, message};
  }

  const rowInfo = readRowData(sheet, lastRow);
  if (!rowInfo) {
    const message = 'Não foi possível ler a última linha.';
    logWarn('onChange', `Linha ${lastRow} ilegível ou vazia`);
    return {success: false, message};
  }

  const lead = mapRowToLead(rowInfo.headers, rowInfo.rowData, config);
  const missing = getMissingRequiredFields(lead);
  if (missing.length > 0) {
    const message = `Campos obrigatórios ausentes: ${formatMissingFields(missing)}`;
    logWarn('onChange', `Linha ${lastRow} ignorada | campos ausentes: ${missing.join(', ')}`);
    return {success: false, message};
  }

  const result = sendLeadToApi(lead, config, {row: lastRow});
  return {success: result.success, message: result.message};
}

export function onChangeHandler(e: GoogleAppsScript.Events.SheetsOnChange): void {
  try {
    const config = getConfig();

    logInfo(
        'onChange',
        `Iniciado | changeType=${e.changeType} | enabled=${config.enabled} | ` +
        `aba=${config.sheetName}`,
    );

    if (!ensureAuthorizationOrNotify()) {
      logWarn('onChange', 'Reautorização necessária — execução interrompida');
      return;
    }

    if (!config.enabled) {
      logInfo('onChange', 'Integração desativada — ignorado');
      return;
    }

    if (!RELEVANT_CHANGE_TYPES.has(e.changeType)) {
      logInfo('onChange', `Tipo de alteração ignorado: ${e.changeType}`);
      return;
    }

    if (isDebounced()) {
      logInfo('onChange', `Debounce ativo (${DEBOUNCE_SECONDS}s) — ignorado`);
      return;
    }
    setDebounce();

    const sheet = getConfiguredSheet();
    if (!sheet) {
      logError('onChange', `Aba "${config.sheetName}" não encontrada`);
      return;
    }

    const result = processNewRows();
    logInfo(
        'onChange',
        `Concluído | ${formatBatchSummary(
            result.sent,
            result.skipped,
            result.errors,
            result.processedUntil,
        )}`,
    );

    if (result.sent > 0) {
      showSuccessToast(`${result.sent} lead(s) enviado(s) com sucesso.`);
    } else if (result.errors > 0) {
      const firstError = result.errorMessages[0] || 'erro desconhecido';
      showErrorToast(
          `${result.errors} lead(s) com erro. Ex.: ${firstError}. Verifique os logs.`,
      );
    } else if (result.skipped > 0 && result.processedUntil > config.lastProcessedRow) {
      showWarningToast(
          `${result.skipped} linha(s) ignorada(s) por dados incompletos.`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('onChange', 'Exceção não tratada', message);
    throw error;
  }
}
