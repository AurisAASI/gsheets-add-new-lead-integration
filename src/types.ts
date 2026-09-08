export const DEFAULT_SHEET_NAME = 'Base Dados';
export const DEFAULT_SOURCE = 'Planilha Funil';
export const DEFAULT_STATUS = 'Aguardando contato';
export const HEADER_ROW = 1;
export const DEBOUNCE_SECONDS = 5;

/** Reserved sheet for per-request send history (auto-created by the add-on). */
export const HISTORY_SHEET_NAME = 'Lead Control - Histórico';
export const HISTORY_MAX_ROWS = 1000;
export const HISTORY_WRITE_FLAG_TTL_SECONDS = 30;

export const HISTORY_HEADERS = [
  'Data/hora',
  'Origem',
  'Linha',
  'Nome',
  'Resultado',
  'HTTP',
  'Mensagem',
  'Endpoint',
] as const;

export type RequestLogOrigin = 'Automático' | 'Teste' | 'Reprocessar';
export type RequestLogResult = 'Sucesso' | 'Duplicado' | 'Erro' | 'Ignorado';

export interface RequestLogEntry {
  timestamp: string;
  origin: RequestLogOrigin;
  row: number | '';
  name: string;
  result: RequestLogResult;
  statusCode: number | '';
  message: string;
  endpoint: string;
}

export const PROPERTY_KEYS = {
  API_ENDPOINT: 'apiEndpoint',
  API_KEY: 'apiKey',
  COMPANY_ID: 'companyId',
  SHEET_NAME: 'sheetName',
  ENABLED: 'enabled',
  LAST_PROCESSED_ROW: 'lastProcessedRow',
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

