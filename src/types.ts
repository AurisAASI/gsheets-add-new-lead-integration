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
} as const;

export interface IntegrationConfig {
  apiEndpoint: string;
  apiKey: string;
  companyId: string;
  sheetName: string;
  enabled: boolean;
  lastProcessedRow: number;
}

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
