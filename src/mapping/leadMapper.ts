import {sanitizePhoneCell} from '../sync/phoneSanitize';
import {sanitizeStatusLead} from '../sync/statusSanitize';
import {
  DEFAULT_SOURCE,
  DEFAULT_STATUS,
  HEADER_ROW,
  IntegrationConfig,
  LeadPayload,
  MappableLeadField,
  RequiredLeadField,
} from '../types';

const REQUIRED_FIELDS: RequiredLeadField[] = [
  'fullName',
  'phone',
  'city',
  'companyID',
  'source',
];

export const FIELD_LABELS_PT: Record<MappableLeadField, string> = {
  fullName: 'Nome completo',
  phone: 'Telefone',
  city: 'Cidade',
  email: 'E-mail',
  source: 'Fonte',
  statusLead: 'Status do lead',
};

export const OPTIONAL_MAPPABLE_FIELDS: MappableLeadField[] = ['email', 'statusLead'];

export const UNMAPPED_OPTION = '— Não mapear —';

function getVal(
    headers: string[],
    rowData: unknown[],
    colName: string,
): unknown {
  if (!colName) {
    return null;
  }
  const index = headers.findIndex(
      (h) => h.toString().toLowerCase().trim() === colName.toLowerCase(),
  );
  return index !== -1 ? rowData[index] : null;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : String(value);
  }
  return String(value).trim();
}

export function getSheetHeaders(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
): string[] {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return [];
  }

  return sheet
      .getRange(HEADER_ROW, 1, 1, lastColumn)
      .getValues()[0]
      .map((h) => String(h).trim())
      .filter((h) => h.length > 0);
}

export interface MapRowResult {
  lead: LeadPayload;
  statusWarning?: string;
}

export function mapRowToLead(
    headers: string[],
    rowData: unknown[],
    config: IntegrationConfig,
): LeadPayload {
  return mapRowToLeadDetailed(headers, rowData, config).lead;
}

export function mapRowToLeadDetailed(
    headers: string[],
    rowData: unknown[],
    config: IntegrationConfig,
): MapRowResult {
  const mappings = config.columnMappings;

  const emailCol = mappings.email?.trim();
  const statusCol = mappings.statusLead?.trim();
  const sourceCol = mappings.source?.trim();

  const rawStatus = statusCol ?
    cellToString(getVal(headers, rowData, statusCol)) || DEFAULT_STATUS :
    DEFAULT_STATUS;
  const statusResult = sanitizeStatusLead(rawStatus);

  const lead: LeadPayload = {
    fullName: cellToString(getVal(headers, rowData, mappings.fullName)),
    phone: sanitizePhoneCell(getVal(headers, rowData, mappings.phone)),
    city: cellToString(getVal(headers, rowData, mappings.city)),
    email: emailCol ?
      cellToString(getVal(headers, rowData, emailCol)) :
      '',
    source: sourceCol ?
      cellToString(getVal(headers, rowData, sourceCol)) || DEFAULT_SOURCE :
      DEFAULT_SOURCE,
    companyID: config.companyId,
    statusLead: statusResult.statusLead,
  };

  const statusWarning =
    statusResult.usedDefault && statusResult.original ?
      `Status "${statusResult.original}" inválido — usando ${DEFAULT_STATUS}` :
      undefined;

  return {lead, statusWarning};
}

export function getMissingRequiredFields(lead: LeadPayload): RequiredLeadField[] {
  return REQUIRED_FIELDS.filter((field) => !lead[field]);
}

export function formatMissingFields(missing: RequiredLeadField[]): string {
  const labels = missing.map((field) => {
    if (field === 'companyID') {
      return 'ID da empresa';
    }
    return FIELD_LABELS_PT[field as MappableLeadField] || field;
  });
  return labels.join(', ');
}

export function readRowData(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    row: number,
): {headers: string[]; rowData: unknown[]} | null {
  if (row <= HEADER_ROW) {
    return null;
  }

  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return null;
  }

  const headers = sheet
      .getRange(HEADER_ROW, 1, 1, lastColumn)
      .getValues()[0]
      .map((h) => String(h));

  const rowData = sheet.getRange(row, 1, 1, lastColumn).getValues()[0];
  return {headers, rowData};
}

/**
 * Read header + a contiguous block of rows in one getValues call.
 */
export function readRowBlock(
    sheet: GoogleAppsScript.Spreadsheet.Sheet,
    startRow: number,
    endRow: number,
): {headers: string[]; rows: Array<{row: number; rowData: unknown[]}>} | null {
  if (endRow < startRow || startRow <= HEADER_ROW) {
    return null;
  }

  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) {
    return null;
  }

  const headers = sheet
      .getRange(HEADER_ROW, 1, 1, lastColumn)
      .getValues()[0]
      .map((h) => String(h));

  const height = endRow - startRow + 1;
  const values = sheet.getRange(startRow, 1, height, lastColumn).getValues();
  const rows = values.map((rowData, index) => ({
    row: startRow + index,
    rowData: rowData as unknown[],
  }));

  return {headers, rows};
}
