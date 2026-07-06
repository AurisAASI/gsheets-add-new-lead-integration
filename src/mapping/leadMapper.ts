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

export function mapRowToLead(
    headers: string[],
    rowData: unknown[],
    config: IntegrationConfig,
): LeadPayload {
  const mappings = config.columnMappings;

  const emailCol = mappings.email?.trim();
  const statusCol = mappings.statusLead?.trim();
  const sourceCol = mappings.source?.trim();

  return {
    fullName: String(getVal(headers, rowData, mappings.fullName) || '').trim(),
    phone: String(getVal(headers, rowData, mappings.phone) || '').trim(),
    city: String(getVal(headers, rowData, mappings.city) || '').trim(),
    email: emailCol ?
      String(getVal(headers, rowData, emailCol) || '').trim() :
      '',
    source: sourceCol ?
      String(getVal(headers, rowData, sourceCol) || DEFAULT_SOURCE).trim() :
      DEFAULT_SOURCE,
    companyID: config.companyId,
    statusLead: statusCol ?
      String(getVal(headers, rowData, statusCol) || DEFAULT_STATUS).trim() :
      DEFAULT_STATUS,
  };
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
