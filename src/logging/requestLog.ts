import {
  HISTORY_HEADERS,
  HISTORY_MAX_ROWS,
  HISTORY_SHEET_NAME,
  HISTORY_WRITE_FLAG_TTL_SECONDS,
  RequestLogEntry,
  RequestLogOrigin,
  RequestLogResult,
} from '../types';
import {logWarn, sanitizeEndpoint, truncateText} from './logger';

const HISTORY_WRITE_FLAG_KEY = 'lead-control:history-write';

function getDocumentCacheSafe(): GoogleAppsScript.Cache.Cache | null {
  try {
    return CacheService.getDocumentCache();
  } catch {
    return null;
  }
}

export function isHistoryWriteInProgress(): boolean {
  const cache = getDocumentCacheSafe();
  if (!cache) {
    return false;
  }
  return cache.get(HISTORY_WRITE_FLAG_KEY) !== null;
}

function setHistoryWriteFlag(): void {
  const cache = getDocumentCacheSafe();
  if (!cache) {
    return;
  }
  cache.put(HISTORY_WRITE_FLAG_KEY, '1', HISTORY_WRITE_FLAG_TTL_SECONDS);
}

function clearHistoryWriteFlag(): void {
  const cache = getDocumentCacheSafe();
  if (!cache) {
    return;
  }
  cache.remove(HISTORY_WRITE_FLAG_KEY);
}

function formatTimestamp(date = new Date()): string {
  return Utilities.formatDate(
      date,
      Session.getScriptTimeZone() || 'America/Sao_Paulo',
      'dd/MM/yyyy HH:mm:ss',
  );
}

function ensureHeaderRow(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const expected = HISTORY_HEADERS.length;
  const firstRow = sheet.getRange(1, 1, 1, expected).getValues()[0];
  const matches = HISTORY_HEADERS.every(
      (header, index) => String(firstRow[index] || '') === header,
  );
  if (!matches) {
    sheet.getRange(1, 1, 1, expected).setValues([HISTORY_HEADERS.slice()]);
    sheet.getRange(1, 1, 1, expected).setFontWeight('bold');
  }
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
  }
}

/**
 * Creates the history sheet automatically if missing.
 * Idempotent: reuses an existing sheet and only ensures the header.
 * Manages the anti-echo write flag itself.
 */
export function ensureHistorySheet(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): GoogleAppsScript.Spreadsheet.Sheet | null {
  setHistoryWriteFlag();
  try {
    return ensureHistorySheetUnlocked(spreadsheet);
  } finally {
    clearHistoryWriteFlag();
  }
}

/** Internal: assumes caller already set the history-write flag when needed. */
function ensureHistorySheetUnlocked(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): GoogleAppsScript.Spreadsheet.Sheet | null {
  try {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return null;
    }

    let sheet = ss.getSheetByName(HISTORY_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(HISTORY_SHEET_NAME);
      sheet.getRange(1, 1, 1, HISTORY_HEADERS.length)
          .setValues([HISTORY_HEADERS.slice()])
          .setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.setColumnWidths(1, HISTORY_HEADERS.length, 120);
      sheet.setColumnWidth(1, 150);
      sheet.setColumnWidth(7, 280);
    } else {
      ensureHeaderRow(sheet);
    }

    return sheet;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn('config', `Falha ao garantir aba de histórico | ${message}`);
    return null;
  }
}

function trimHistoryIfNeeded(sheet: GoogleAppsScript.Spreadsheet.Sheet): void {
  const lastRow = sheet.getLastRow();
  // Header + HISTORY_MAX_ROWS data rows
  const maxTotalRows = HISTORY_MAX_ROWS + 1;
  if (lastRow <= maxTotalRows) {
    return;
  }
  const rowsToDelete = lastRow - maxTotalRows;
  // Delete oldest data rows (just below the header)
  sheet.deleteRows(2, rowsToDelete);
}

function entryToRow(entry: RequestLogEntry): Array<string | number> {
  return [
    entry.timestamp,
    entry.origin,
    entry.row,
    entry.name,
    entry.result,
    entry.statusCode,
    entry.message,
    entry.endpoint,
  ];
}

export function appendRequestLog(
    entry: Omit<RequestLogEntry, 'timestamp'> & {timestamp?: string},
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): void {
  try {
    setHistoryWriteFlag();
    try {
      const sheet = ensureHistorySheetUnlocked(spreadsheet);
      if (!sheet) {
        return;
      }

      const fullEntry: RequestLogEntry = {
        ...entry,
        timestamp: entry.timestamp || formatTimestamp(),
        message: truncateText(entry.message || ''),
        endpoint: entry.endpoint ?
          (entry.endpoint.includes('/') ?
            sanitizeEndpoint(entry.endpoint) :
            entry.endpoint) :
          '',
      };

      sheet.appendRow(entryToRow(fullEntry));
      trimHistoryIfNeeded(sheet);
    } finally {
      clearHistoryWriteFlag();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn('config', `Falha ao gravar histórico de envio | ${message}`);
  }
}

export function getLatestRequestLog(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): RequestLogEntry | null {
  try {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      return null;
    }
    const sheet = ss.getSheetByName(HISTORY_SHEET_NAME);
    if (!sheet) {
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return null;
    }

    const values = sheet
        .getRange(lastRow, 1, 1, HISTORY_HEADERS.length)
        .getValues()[0];

    return {
      timestamp: String(values[0] || ''),
      origin: String(values[1] || '') as RequestLogOrigin,
      row: values[2] === '' || values[2] === null ? '' : Number(values[2]),
      name: String(values[3] || ''),
      result: String(values[4] || '') as RequestLogResult,
      statusCode: values[5] === '' || values[5] === null ? '' : Number(values[5]),
      message: String(values[6] || ''),
      endpoint: String(values[7] || ''),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn('config', `Falha ao ler último histórico | ${message}`);
    return null;
  }
}

export function resultFromOutcome(
    outcome: 'created' | 'duplicate' | 'error',
): RequestLogResult {
  if (outcome === 'created') {
    return 'Sucesso';
  }
  if (outcome === 'duplicate') {
    return 'Duplicado';
  }
  return 'Erro';
}
