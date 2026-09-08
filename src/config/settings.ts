import {logWarn} from '../logging/logger';
import {
  ColumnMappings,
  DEFAULT_COLUMN_MAPPINGS,
  DEFAULT_SHEET_NAME,
  HEADER_ROW,
  IntegrationConfig,
  PROPERTY_KEYS,
  REQUIRED_COLUMN_FIELDS,
} from '../types';

interface PropStore {
  getProperty(key: string): string | null;
  setProperty(key: string, value: string): GoogleAppsScript.Properties.Properties;
  setProperties(
      properties: {[key: string]: string},
  ): GoogleAppsScript.Properties.Properties;
}

function getActiveSpreadsheetId(): string | null {
  try {
    return SpreadsheetApp.getActiveSpreadsheet()?.getId() ?? null;
  } catch {
    return null;
  }
}

/**
 * DocumentProperties is preferred (per-spreadsheet, all editors).
 * Some Workspace add-on / auth contexts throw on getDocumentProperties();
 * fall back to UserProperties keyed by spreadsheet ID.
 */
function getPropStore(): PropStore {
  try {
    const docProps = PropertiesService.getDocumentProperties();
    if (docProps) {
      // Probe access — some contexts return an object that fails on first read.
      docProps.getProperty('__probe__');
      return docProps;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn('config', `DocumentProperties indisponível — fallback UserProperties | ${message}`);
  }

  const userProps = PropertiesService.getUserProperties();
  const ssId = getActiveSpreadsheetId() || 'unknown';
  const prefix = `ss:${ssId}:`;

  return {
    getProperty(key: string): string | null {
      return userProps.getProperty(prefix + key);
    },
    setProperty(key: string, value: string) {
      return userProps.setProperty(prefix + key, value);
    },
    setProperties(properties: {[key: string]: string}) {
      const prefixed: {[key: string]: string} = {};
      Object.keys(properties).forEach((key) => {
        prefixed[prefix + key] = properties[key];
      });
      return userProps.setProperties(prefixed);
    },
  };
}

function parseBoolean(value: string | null, fallback = false): boolean {
  if (value === null || value === '') {
    return fallback;
  }
  return value === 'true';
}

function parseNumber(value: string | null, fallback = 0): number {
  if (value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseColumnMappings(value: string | null): ColumnMappings {
  if (!value) {
    return {...DEFAULT_COLUMN_MAPPINGS};
  }
  try {
    const parsed = JSON.parse(value) as Partial<ColumnMappings>;
    return {...DEFAULT_COLUMN_MAPPINGS, ...parsed};
  } catch {
    logWarn('config', 'Mapeamento de colunas corrompido — usando valores padrão');
    return {...DEFAULT_COLUMN_MAPPINGS};
  }
}

export function getConfig(): IntegrationConfig {
  const props = getPropStore();
  return {
    apiEndpoint: props.getProperty(PROPERTY_KEYS.API_ENDPOINT) || '',
    apiKey: props.getProperty(PROPERTY_KEYS.API_KEY) || '',
    companyId: props.getProperty(PROPERTY_KEYS.COMPANY_ID) || '',
    sheetName: props.getProperty(PROPERTY_KEYS.SHEET_NAME) || DEFAULT_SHEET_NAME,
    enabled: parseBoolean(props.getProperty(PROPERTY_KEYS.ENABLED)),
    lastProcessedRow: parseNumber(props.getProperty(PROPERTY_KEYS.LAST_PROCESSED_ROW)),
    columnMappings: parseColumnMappings(props.getProperty(PROPERTY_KEYS.COLUMN_MAPPINGS)),
  };
}

export function saveConfig(
    partial: Partial<IntegrationConfig>,
): IntegrationConfig {
  const props = getPropStore();
  const current = getConfig();
  const next: IntegrationConfig = {...current, ...partial};

  props.setProperties({
    [PROPERTY_KEYS.API_ENDPOINT]: next.apiEndpoint,
    [PROPERTY_KEYS.API_KEY]: next.apiKey,
    [PROPERTY_KEYS.COMPANY_ID]: next.companyId,
    [PROPERTY_KEYS.SHEET_NAME]: next.sheetName,
    [PROPERTY_KEYS.ENABLED]: String(next.enabled),
    [PROPERTY_KEYS.LAST_PROCESSED_ROW]: String(next.lastProcessedRow),
    [PROPERTY_KEYS.COLUMN_MAPPINGS]: JSON.stringify(next.columnMappings),
  });

  return next;
}

export function setLastProcessedRow(row: number): void {
  getPropStore().setProperty(PROPERTY_KEYS.LAST_PROCESSED_ROW, String(row));
}

export function isConfigComplete(config: IntegrationConfig): boolean {
  return Boolean(
      config.apiEndpoint &&
      config.apiKey &&
      config.companyId &&
      config.sheetName,
  );
}

export function isColumnMappingComplete(config: IntegrationConfig): boolean {
  return REQUIRED_COLUMN_FIELDS.every(
      (field) => Boolean(config.columnMappings[field]?.trim()),
  );
}

export function getConfiguredSheet(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): GoogleAppsScript.Spreadsheet.Sheet | null {
  const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    return null;
  }
  const config = getConfig();
  return ss.getSheetByName(config.sheetName);
}

export function initializeLastProcessedRow(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): number {
  const sheet = getConfiguredSheet(spreadsheet);
  if (!sheet) {
    return 0;
  }
  const lastRow = Math.max(sheet.getLastRow(), HEADER_ROW);
  setLastProcessedRow(lastRow);
  return lastRow;
}
