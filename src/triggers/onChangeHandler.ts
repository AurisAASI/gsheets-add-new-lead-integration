import {sendLeadToApi} from '../api/leadClient';
import {
  getConfig,
  getConfiguredSheet,
  setLastProcessedRow,
} from '../config/settings';
import {
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

function processRow(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    row: number,
): {sent: number; skipped: number; errors: number} {
  const config = getConfig();
  const rowInfo = readRowData(sheet, row);
  if (!rowInfo) {
    return {sent: 0, skipped: 1, errors: 0};
  }

  const lead = mapRowToLead(rowInfo.headers, rowInfo.rowData, config);
  const missing = getMissingRequiredFields(lead);

  if (missing.length > 0) {
    console.log(`Linha ${row} ignorada. Campos ausentes: ${missing.join(', ')}`);
    return {sent: 0, skipped: 1, errors: 0};
  }

  const result = sendLeadToApi(lead, config);
  if (result.success) {
    console.log(`Linha ${row} enviada: ${lead.fullName}`);
    return {sent: 1, skipped: 0, errors: 0};
  }

  console.error(`Linha ${row} falhou: ${result.message}`);
  return {sent: 0, skipped: 0, errors: 1};
}

export function processNewRows(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): {sent: number; skipped: number; errors: number; processedUntil: number} {
  const config = getConfig();
  if (!config.enabled) {
    return {sent: 0, skipped: 0, errors: 0, processedUntil: config.lastProcessedRow};
  }

  const sheet = getConfiguredSheet(spreadsheet);
  if (!sheet) {
    console.error(`Aba "${config.sheetName}" não encontrada.`);
    return {sent: 0, skipped: 0, errors: 0, processedUntil: config.lastProcessedRow};
  }

  const lastRow = sheet.getLastRow();
  const startRow = Math.max(config.lastProcessedRow + 1, HEADER_ROW + 1);

  if (lastRow < startRow) {
    return {sent: 0, skipped: 0, errors: 0, processedUntil: config.lastProcessedRow};
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (let row = startRow; row <= lastRow; row++) {
    const result = processRow(sheet, row);
    sent += result.sent;
    skipped += result.skipped;
    errors += result.errors;
  }

  setLastProcessedRow(lastRow);
  return {sent, skipped, errors, processedUntil: lastRow};
}

export function processLastRow(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): {success: boolean; message: string} {
  const config = getConfig();
  const sheet = getConfiguredSheet(spreadsheet);

  if (!sheet) {
    return {success: false, message: `Aba "${config.sheetName}" não encontrada.`};
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= HEADER_ROW) {
    return {success: false, message: 'Não há linhas de dados para enviar.'};
  }

  const rowInfo = readRowData(sheet, lastRow);
  if (!rowInfo) {
    return {success: false, message: 'Não foi possível ler a última linha.'};
  }

  const lead = mapRowToLead(rowInfo.headers, rowInfo.rowData, config);
  const missing = getMissingRequiredFields(lead);
  if (missing.length > 0) {
    return {
      success: false,
      message: `Campos obrigatórios ausentes: ${missing.join(', ')}`,
    };
  }

  const result = sendLeadToApi(lead, config);
  return {success: result.success, message: result.message};
}

export function onChangeHandler(e: GoogleAppsScript.Events.SheetsOnChange): void {
  if (!ensureAuthorizationOrNotify()) {
    return;
  }

  const config = getConfig();
  if (!config.enabled) {
    return;
  }

  if (!RELEVANT_CHANGE_TYPES.has(e.changeType)) {
    return;
  }

  if (isDebounced()) {
    return;
  }
  setDebounce();

  const sheet = getConfiguredSheet();
  if (!sheet) {
    console.error(`Aba "${config.sheetName}" não encontrada.`);
    return;
  }

  const result = processNewRows();
  if (result.sent > 0) {
    showSuccessToast(`${result.sent} lead(s) enviado(s) com sucesso.`);
  } else if (result.errors > 0) {
    showErrorToast(`${result.errors} lead(s) com erro. Verifique os logs.`);
  } else if (result.skipped > 0 && result.processedUntil > config.lastProcessedRow) {
    showWarningToast(
        `${result.skipped} linha(s) ignorada(s) por dados incompletos.`,
    );
  }
}
