import {
  DEFAULT_SOURCE,
  DEFAULT_STATUS,
  HEADER_ROW,
  IntegrationConfig,
  LeadPayload,
  RequiredLeadField,
} from '../types';

const COLUMN_MAP: Record<keyof Omit<LeadPayload, 'companyID'>, string> = {
  fullName: 'nome',
  phone: 'telefone',
  city: 'cidade',
  email: 'email',
  source: 'fonte',
  statusLead: 'status',
};

const REQUIRED_FIELDS: RequiredLeadField[] = [
  'fullName',
  'phone',
  'city',
  'companyID',
  'source',
];

function getVal(
    headers: string[],
    rowData: unknown[],
    colName: string,
): unknown {
  const index = headers.findIndex(
      (h) => h.toString().toLowerCase().trim() === colName.toLowerCase(),
  );
  return index !== -1 ? rowData[index] : null;
}

export function mapRowToLead(
    headers: string[],
    rowData: unknown[],
    config: IntegrationConfig,
): LeadPayload {
  return {
    fullName: String(getVal(headers, rowData, COLUMN_MAP.fullName) || '').trim(),
    phone: String(getVal(headers, rowData, COLUMN_MAP.phone) || '').trim(),
    city: String(getVal(headers, rowData, COLUMN_MAP.city) || '').trim(),
    email: String(getVal(headers, rowData, COLUMN_MAP.email) || '').trim(),
    source: String(getVal(headers, rowData, COLUMN_MAP.source) || DEFAULT_SOURCE).trim(),
    companyID: config.companyId,
    statusLead: String(
        getVal(headers, rowData, COLUMN_MAP.statusLead) || DEFAULT_STATUS,
    ).trim(),
  };
}

export function getMissingRequiredFields(lead: LeadPayload): RequiredLeadField[] {
  return REQUIRED_FIELDS.filter((field) => !lead[field]);
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

export function getExpectedColumns(): string[] {
  return Object.values(COLUMN_MAP);
}
