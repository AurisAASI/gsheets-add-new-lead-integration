import {logInfo, logWarn} from '../logging/logger';
import {
  clampSettledThrough,
  migrateFromLastProcessedRow,
  OpenRowsMap,
  SyncCursor,
} from '../sync/cursor';
import {
  ColumnMappings,
  DEFAULT_COLUMN_MAPPINGS,
  DEFAULT_SHEET_NAME,
  HEADER_ROW,
  IntegrationConfig,
  PROPERTY_KEYS,
  REQUIRED_COLUMN_FIELDS,
} from '../types';

export class DocumentPropertiesUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentPropertiesUnavailableError';
  }
}

function getActiveSpreadsheetId(): string | null {
  try {
    return SpreadsheetApp.getActiveSpreadsheet()?.getId() ?? null;
  } catch {
    return null;
  }
}

function getDocumentPropertiesOrThrow(): GoogleAppsScript.Properties.Properties {
  try {
    const docProps = PropertiesService.getDocumentProperties();
    if (!docProps) {
      throw new DocumentPropertiesUnavailableError(
          'DocumentProperties indisponível neste contexto.',
      );
    }
    docProps.getProperty('__probe__');
    return docProps;
  } catch (error) {
    if (error instanceof DocumentPropertiesUnavailableError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DocumentPropertiesUnavailableError(
        `DocumentProperties indisponível: ${message}`,
    );
  }
}

function readUserProperty(key: string): string | null {
  try {
    const userProps = PropertiesService.getUserProperties();
    const ssId = getActiveSpreadsheetId() || 'unknown';
    return userProps.getProperty(`ss:${ssId}:${key}`);
  } catch {
    return null;
  }
}

/**
 * One-time copy of legacy UserProperties config into DocumentProperties
 * when the document store has no endpoint yet.
 */
function migrateUserPropertiesIfNeeded(
    docProps: GoogleAppsScript.Properties.Properties,
): void {
  if (docProps.getProperty(PROPERTY_KEYS.API_ENDPOINT)) {
    return;
  }
  const endpoint = readUserProperty(PROPERTY_KEYS.API_ENDPOINT);
  if (!endpoint) {
    return;
  }

  const keys = [
    PROPERTY_KEYS.API_ENDPOINT,
    PROPERTY_KEYS.API_KEY,
    PROPERTY_KEYS.COMPANY_ID,
    PROPERTY_KEYS.SHEET_NAME,
    PROPERTY_KEYS.ENABLED,
    PROPERTY_KEYS.LAST_PROCESSED_ROW,
    PROPERTY_KEYS.COLUMN_MAPPINGS,
  ];
  const migrated: {[key: string]: string} = {};
  keys.forEach((key) => {
    const value = readUserProperty(key);
    if (value !== null && value !== '') {
      migrated[key] = value;
    }
  });
  if (Object.keys(migrated).length === 0) {
    return;
  }
  docProps.setProperties(migrated);
  logInfo('config', 'Configuração migrada de UserProperties para DocumentProperties');
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

function resolveCursorFromProps(
    props: GoogleAppsScript.Properties.Properties,
): SyncCursor {
  const settledRaw = props.getProperty(PROPERTY_KEYS.SETTLED_THROUGH);
  const legacy = parseNumber(props.getProperty(PROPERTY_KEYS.LAST_PROCESSED_ROW));

  if (settledRaw === null || settledRaw === '') {
    return migrateFromLastProcessedRow(legacy);
  }

  let openRows: OpenRowsMap = {};
  const openRaw = props.getProperty(PROPERTY_KEYS.OPEN_ROWS);
  if (openRaw) {
    try {
      openRows = JSON.parse(openRaw) as OpenRowsMap;
    } catch {
      logWarn('config', 'openRows corrompido — reiniciando mapa vazio');
      openRows = {};
    }
  }

  return {
    settledThrough: parseNumber(settledRaw, legacy),
    openRows,
  };
}

export function getConfig(): IntegrationConfig {
  const props = getDocumentPropertiesOrThrow();
  migrateUserPropertiesIfNeeded(props);
  const cursor = resolveCursorFromProps(props);

  return {
    apiEndpoint: props.getProperty(PROPERTY_KEYS.API_ENDPOINT) || '',
    apiKey: props.getProperty(PROPERTY_KEYS.API_KEY) || '',
    companyId: props.getProperty(PROPERTY_KEYS.COMPANY_ID) || '',
    sheetName: props.getProperty(PROPERTY_KEYS.SHEET_NAME) || DEFAULT_SHEET_NAME,
    enabled: parseBoolean(props.getProperty(PROPERTY_KEYS.ENABLED)),
    lastProcessedRow: cursor.settledThrough,
    settledThrough: cursor.settledThrough,
    openRowsJson: JSON.stringify(cursor.openRows),
    columnMappings: parseColumnMappings(
        props.getProperty(PROPERTY_KEYS.COLUMN_MAPPINGS),
    ),
  };
}

export function getSyncCursor(): SyncCursor {
  const props = getDocumentPropertiesOrThrow();
  migrateUserPropertiesIfNeeded(props);
  return resolveCursorFromProps(props);
}

export function saveSyncCursor(cursor: SyncCursor): void {
  const props = getDocumentPropertiesOrThrow();
  props.setProperties({
    [PROPERTY_KEYS.SETTLED_THROUGH]: String(cursor.settledThrough),
    [PROPERTY_KEYS.OPEN_ROWS]: JSON.stringify(cursor.openRows),
    [PROPERTY_KEYS.LAST_PROCESSED_ROW]: String(cursor.settledThrough),
  });
}

export function saveConfig(
    partial: Partial<IntegrationConfig>,
): IntegrationConfig {
  const props = getDocumentPropertiesOrThrow();
  migrateUserPropertiesIfNeeded(props);
  const current = getConfig();
  const next: IntegrationConfig = {...current, ...partial};

  const settledThrough =
    partial.settledThrough !== undefined ?
      partial.settledThrough :
      next.settledThrough;
  const openRowsJson =
    partial.openRowsJson !== undefined ?
      partial.openRowsJson :
      next.openRowsJson;

  props.setProperties({
    [PROPERTY_KEYS.API_ENDPOINT]: next.apiEndpoint,
    [PROPERTY_KEYS.API_KEY]: next.apiKey,
    [PROPERTY_KEYS.COMPANY_ID]: next.companyId,
    [PROPERTY_KEYS.SHEET_NAME]: next.sheetName,
    [PROPERTY_KEYS.ENABLED]: String(next.enabled),
    [PROPERTY_KEYS.LAST_PROCESSED_ROW]: String(settledThrough),
    [PROPERTY_KEYS.SETTLED_THROUGH]: String(settledThrough),
    [PROPERTY_KEYS.OPEN_ROWS]: openRowsJson || '{}',
    [PROPERTY_KEYS.COLUMN_MAPPINGS]: JSON.stringify(next.columnMappings),
  });

  return getConfig();
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

/**
 * Initialize cursor to current last row so existing history is not re-sent.
 */
export function initializeSettledThrough(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): number {
  const sheet = getConfiguredSheet(spreadsheet);
  if (!sheet) {
    return 0;
  }
  const lastRow = Math.max(sheet.getLastRow(), HEADER_ROW);
  saveSyncCursor({settledThrough: lastRow, openRows: {}});
  return lastRow;
}

/** @deprecated Use initializeSettledThrough */
export function initializeLastProcessedRow(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): number {
  return initializeSettledThrough(spreadsheet);
}

export function clampCursorToSheet(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): SyncCursor {
  const cursor = getSyncCursor();
  const sheet = getConfiguredSheet(spreadsheet);
  if (!sheet) {
    return cursor;
  }
  const lastRow = sheet.getLastRow();
  const settledThrough = clampSettledThrough(
      cursor.settledThrough,
      lastRow,
      HEADER_ROW,
  );
  if (settledThrough === cursor.settledThrough) {
    return cursor;
  }
  const next = {...cursor, settledThrough};
  saveSyncCursor(next);
  return next;
}
