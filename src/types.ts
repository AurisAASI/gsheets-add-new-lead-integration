export const DEFAULT_SHEET_NAME = 'Base Dados';
export const DEFAULT_SOURCE = 'Planilha Funil';
export const DEFAULT_STATUS = 'Aguardando contato';
export const HEADER_ROW = 1;
export const DEBOUNCE_SECONDS = 5;

export const PROPERTY_KEYS = {
  API_ENDPOINT: 'apiEndpoint',
  API_KEY: 'apiKey',
  COMPANY_ID: 'companyId',
  SHEET_NAME: 'sheetName',
  ENABLED: 'enabled',
  LAST_PROCESSED_ROW: 'lastProcessedRow',
  LAST_AUTH_EMAIL_DATE: 'lastAuthEmailDate',
  COLUMN_MAPPINGS: 'columnMappings',
} as const;

export interface LeadPayload {
  fullName: string;
  phone: string;
  city: string;
  email: string;
  source: string;
  companyID: string;
  statusLead: string;
}

export type RequiredLeadField = 'fullName' | 'phone' | 'city' | 'companyID' | 'source';

export type MappableLeadField = keyof Omit<LeadPayload, 'companyID'>;

export interface ColumnMappings {
  fullName: string;
  phone: string;
  city: string;
  email: string;
  source: string;
  statusLead: string;
}

export const DEFAULT_COLUMN_MAPPINGS: ColumnMappings = {
  fullName: 'nome',
  phone: 'telefone',
  city: 'cidade',
  email: 'email',
  source: 'fonte',
  statusLead: 'status',
};

export const REQUIRED_COLUMN_FIELDS: Array<keyof Pick<ColumnMappings, 'fullName' | 'phone' | 'city' | 'source'>> = [
  'fullName',
  'phone',
  'city',
  'source',
];

export interface IntegrationConfig {
  apiEndpoint: string;
  apiKey: string;
  companyId: string;
  sheetName: string;
  enabled: boolean;
  lastProcessedRow: number;
  columnMappings: ColumnMappings;
}

