import {sendLeadToApi, sendLeadsBatch, SendLeadResult} from '../api/leadClient';
import {
  clampCursorToSheet,
  getConfig,
  getConfiguredSheet,
  getSyncCursor,
  isConfigComplete,
  saveSyncCursor,
} from '../config/settings';
import {logError, logInfo, logWarn, sanitizeEndpoint} from '../logging/logger';
import {
  appendRequestLogBatch,
  getLatestResultByRows,
  resultFromOutcome,
} from '../logging/requestLog';
import {
  formatMissingFields,
  getMissingRequiredFields,
  mapRowToLeadDetailed,
  readRowBlock,
  readRowData,
} from '../mapping/leadMapper';
import {
  HEADER_ROW,
  REPROCESS_UNSENT_LIMIT,
  RequestLogOrigin,
  RequestLogResult,
} from '../types';
import {
  closeRowAndAdvance,
  listCandidateRows,
  SyncCursor,
  upsertOpenRow,
} from './cursor';
import {decideIncompleteRow, lastNDataRows, selectUnsentRows} from './rowOutcome';

const LOCK_TIMEOUT_MS = 30000;

export interface ProcessSummary {
  sent: number;
  duplicates: number;
  skipped: number;
  errors: number;
  pending: number;
  processedUntil: number;
  errorMessages: string[];
  authBlocked: boolean;
}

function emptySummary(settledThrough: number): ProcessSummary {
  return {
    sent: 0,
    duplicates: 0,
    skipped: 0,
    errors: 0,
    pending: 0,
    processedUntil: settledThrough,
    errorMessages: [],
    authBlocked: false,
  };
}

function withDocumentLock<T>(fn: () => T): T {
  const lock = LockService.getDocumentLock();
  const acquired = lock.tryLock(LOCK_TIMEOUT_MS);
  if (!acquired) {
    throw new Error('Não foi possível obter lock do documento (timeout).');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function isRowBlank(rowData: unknown[]): boolean {
  return rowData.every(
      (cell) => cell === null || cell === undefined || String(cell).trim() === '',
  );
}

interface PreparedSend {
  row: number;
  lead: ReturnType<typeof mapRowToLeadDetailed>['lead'];
  statusWarning?: string;
}

function applySendResult(
    cursor: SyncCursor,
    row: number,
    result: SendLeadResult,
    summary: ProcessSummary,
): SyncCursor {
  if (result.success && result.outcome === 'created') {
    summary.sent += 1;
    return closeRowAndAdvance({cursor, row, state: 'sent'});
  }
  if (result.success && result.outcome === 'duplicate') {
    summary.duplicates += 1;
    return closeRowAndAdvance({cursor, row, state: 'duplicate'});
  }

  summary.errors += 1;
  summary.errorMessages.push(`Linha ${row}: ${result.message}`);

  if (result.stopBatch) {
    summary.authBlocked = true;
    return upsertOpenRow(cursor, row, {state: 'retry', note: result.message});
  }

  if (result.closesRow) {
    return closeRowAndAdvance({
      cursor,
      row,
      state: 'failed',
      note: result.message,
    });
  }

  return upsertOpenRow(cursor, row, {state: 'retry', note: result.message});
}

/**
 * Single processing engine used by onChange, hourly sweep, and recovery buttons.
 */
export function processPendingRows(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
    origin: RequestLogOrigin = 'Automático',
    options: {onlyRows?: number[]} = {},
): ProcessSummary {
  return withDocumentLock(() => {
    const config = getConfig();
    if (!config.enabled && origin === 'Automático') {
      return emptySummary(config.settledThrough);
    }
    if (!isConfigComplete(config)) {
      logWarn('onChange', 'Configuração incompleta — processamento ignorado');
      return emptySummary(config.settledThrough);
    }

    let cursor = clampCursorToSheet(spreadsheet);
    const sheet = getConfiguredSheet(spreadsheet);
    if (!sheet) {
      logError('onChange', `Aba "${config.sheetName}" não encontrada`);
      return emptySummary(cursor.settledThrough);
    }

    const lastRow = sheet.getLastRow();
    const candidateRows = options.onlyRows ?
      options.onlyRows.filter((row) => row > HEADER_ROW && row <= lastRow) :
      listCandidateRows(cursor, lastRow, HEADER_ROW);

    const summary = emptySummary(cursor.settledThrough);
    if (candidateRows.length === 0) {
      logInfo('onChange', 'Nenhuma linha candidata para processar');
      return summary;
    }

    const startRow = Math.min(...candidateRows);
    const endRow = Math.max(...candidateRows);
    const block = readRowBlock(sheet, startRow, endRow);
    if (!block) {
      logWarn('onChange', 'Não foi possível ler o bloco de linhas');
      return summary;
    }

    const rowByNumber = new Map(
        block.rows.map((item) => [item.row, item.rowData] as const),
    );
    const endpointHost = sanitizeEndpoint(config.apiEndpoint);
    const nowMs = Date.now();
    const historyEntries: Array<{
      origin: RequestLogOrigin;
      row: number;
      name: string;
      result: RequestLogResult;
      statusCode: number | '';
      message: string;
      endpoint: string;
    }> = [];

    const toSend: PreparedSend[] = [];

    for (const row of candidateRows) {
      if (summary.authBlocked) {
        break;
      }

      const rowData = rowByNumber.get(row);
      if (!rowData || isRowBlank(rowData)) {
        summary.skipped += 1;
        historyEntries.push({
          origin,
          row,
          name: '',
          result: 'Ignorado',
          statusCode: '',
          message: 'Linha ilegível ou vazia',
          endpoint: endpointHost,
        });
        cursor = closeRowAndAdvance({
          cursor,
          row,
          state: 'ignored',
          note: 'vazia',
        });
        continue;
      }

      const mapped = mapRowToLeadDetailed(block.headers, rowData, config);
      const missing = getMissingRequiredFields(mapped.lead);
      if (missing.length > 0) {
        const existing = cursor.openRows[String(row)];
        const decision = decideIncompleteRow(nowMs, existing);
        if (decision.action === 'pending') {
          summary.pending += 1;
          cursor = upsertOpenRow(cursor, row, {
            state: 'pending',
            firstSeenIncompleteMs: decision.firstSeenIncompleteMs,
            note: missing.join(','),
          });
          continue;
        }

        summary.skipped += 1;
        const message = `Campos ausentes: ${formatMissingFields(missing)}`;
        historyEntries.push({
          origin,
          row,
          name: mapped.lead.fullName || '',
          result: 'Ignorado',
          statusCode: '',
          message,
          endpoint: endpointHost,
        });
        cursor = closeRowAndAdvance({
          cursor,
          row,
          state: 'ignored',
          note: message,
        });
        continue;
      }

      toSend.push({
        row,
        lead: mapped.lead,
        statusWarning: mapped.statusWarning,
      });
    }

    if (toSend.length > 0) {
      const batchResults = sendLeadsBatch(
          toSend.map((item) => ({row: item.row, lead: item.lead})),
          config,
      );

      toSend.forEach((item, index) => {
        if (index >= batchResults.length) {
          // Auth stop mid-batch: remaining stay retry
          cursor = upsertOpenRow(cursor, item.row, {state: 'retry'});
          summary.pending += 1;
          return;
        }
        const result = batchResults[index];
        const message = item.statusWarning ?
          `${result.message} (${item.statusWarning})` :
          result.message;
        historyEntries.push({
          origin,
          row: item.row,
          name: item.lead.fullName || '',
          result: resultFromOutcome(result.outcome),
          statusCode: result.statusCode || '',
          message,
          endpoint: endpointHost,
        });
        cursor = applySendResult(cursor, item.row, result, summary);
      });
    }

    appendRequestLogBatch(historyEntries, spreadsheet);
    saveSyncCursor(cursor);
    summary.processedUntil = cursor.settledThrough;

    logInfo(
        'onChange',
        `Lote concluído | enviados=${summary.sent} | duplicados=${summary.duplicates} | ` +
        `ignorados=${summary.skipped} | erros=${summary.errors} | ` +
        `pendentes=${summary.pending} | settledThrough=${cursor.settledThrough}`,
    );

    return summary;
  });
}

/**
 * Manual test / reprocess of a single sheet row (does not use candidate cursor
 * for selection; still updates cursor when the row closes).
 */
export function processSpecificRow(
    row: number,
    spreadsheet: GoogleAppsScript.Spreadsheet.Spreadsheet | undefined,
    origin: RequestLogOrigin,
): {success: boolean; message: string; outcome?: SendLeadResult['outcome']} {
  return withDocumentLock(() => {
    const config = getConfig();
    const sheet = getConfiguredSheet(spreadsheet);
    if (!sheet) {
      return {success: false, message: `Aba "${config.sheetName}" não encontrada.`};
    }

    const rowInfo = readRowData(sheet, row);
    if (!rowInfo) {
      return {success: false, message: 'Não foi possível ler a linha.'};
    }

    const mapped = mapRowToLeadDetailed(rowInfo.headers, rowInfo.rowData, config);
    const missing = getMissingRequiredFields(mapped.lead);
    const endpointHost = sanitizeEndpoint(config.apiEndpoint);

    if (missing.length > 0) {
      const message = `Campos obrigatórios ausentes: ${formatMissingFields(missing)}`;
      appendRequestLogBatch([{
        origin,
        row,
        name: mapped.lead.fullName || '',
        result: 'Ignorado',
        statusCode: '',
        message,
        endpoint: endpointHost,
      }], spreadsheet);
      return {success: false, message};
    }

    const result = sendLeadToApi(mapped.lead, config, {row});
    const message = mapped.statusWarning ?
      `${result.message} (${mapped.statusWarning})` :
      result.message;

    appendRequestLogBatch([{
      origin,
      row,
      name: mapped.lead.fullName || '',
      result: resultFromOutcome(result.outcome),
      statusCode: result.statusCode || '',
      message,
      endpoint: endpointHost,
    }], spreadsheet);

    let cursor = getSyncCursor();
    if (result.closesRow || result.success) {
      cursor = applySendResult(
          cursor,
          row,
          result,
          emptySummary(cursor.settledThrough),
      );
      saveSyncCursor(cursor);
    } else if (!result.closesRow) {
      cursor = upsertOpenRow(cursor, row, {state: 'retry', note: result.message});
      saveSyncCursor(cursor);
    }

    return {
      success: result.success,
      message,
      outcome: result.outcome,
    };
  });
}

export function processLastRow(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
    origin: RequestLogOrigin = 'Teste',
): {success: boolean; message: string; outcome?: SendLeadResult['outcome']} {
  const sheet = getConfiguredSheet(spreadsheet);
  if (!sheet) {
    const config = getConfig();
    return {success: false, message: `Aba "${config.sheetName}" não encontrada.`};
  }
  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) {
    return {success: false, message: 'Não há linhas de dados para enviar.'};
  }
  return processSpecificRow(lastRow, spreadsheet, origin);
}

/**
 * Safety net: reprocess up to the last 50 data rows that are not Sucesso/Duplicado.
 * Does not move the cursor backwards.
 */
export function reprocessUnsentRows(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
    limit = REPROCESS_UNSENT_LIMIT,
): ProcessSummary {
  const sheet = getConfiguredSheet(spreadsheet);
  if (!sheet) {
    const config = getConfig();
    logError('onChange', `Aba "${config.sheetName}" não encontrada`);
    return emptySummary(getSyncCursor().settledThrough);
  }

  const lastRow = sheet.getLastRow();
  const candidates = lastNDataRows(lastRow, HEADER_ROW, limit);
  const latest = getLatestResultByRows(candidates, spreadsheet);
  const onlyRows = selectUnsentRows(candidates, latest);

  logInfo(
      'onChange',
      `Reprocessar não enviados | candidatos=${candidates.length} | ` +
      `selecionados=${onlyRows.length}`,
  );

  return processPendingRows(spreadsheet, 'Reprocessar', {onlyRows});
}
