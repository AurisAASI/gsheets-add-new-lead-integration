import {logError, logInfo, sanitizeEndpoint, truncateText} from '../logging/logger';
import {IntegrationConfig, LeadPayload} from '../types';

export interface SendLeadResult {
  success: boolean;
  statusCode: number;
  message: string;
}

export interface SendLeadContext {
  row?: number;
}

function formatRowContext(row?: number): string {
  return row !== undefined ? `linha=${row}` : 'linha=manual';
}

export function sendLeadToApi(
    lead: LeadPayload,
    config: IntegrationConfig,
    context: SendLeadContext = {},
): SendLeadResult {
  const rowLabel = formatRowContext(context.row);
  const endpointHost = sanitizeEndpoint(config.apiEndpoint);

  logInfo(
      'api',
      `Enviando lead | ${rowLabel} | nome=${lead.fullName} | endpoint=${endpointHost}`,
  );

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': config.apiKey,
    },
    payload: JSON.stringify(lead),
    muteHttpExceptions: true,
  };

  try {
    const response = UrlFetchApp.fetch(config.apiEndpoint, options);
    const statusCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (statusCode === 201 || statusCode === 200) {
      logInfo('api', `Lead enviado | ${rowLabel} | status=${statusCode}`);
      return {
        success: true,
        statusCode,
        message: `Lead ${lead.fullName} enviado com sucesso.`,
      };
    }

    const errorMessage = `Erro ${statusCode}: ${truncateText(responseBody)}`;
    logError('api', `Falha HTTP | ${rowLabel} | status=${statusCode}`, responseBody);
    return {
      success: false,
      statusCode,
      message: errorMessage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('api', `Falha na requisição | ${rowLabel}`, message);
    return {
      success: false,
      statusCode: 0,
      message: `Falha na requisição: ${message}`,
    };
  }
}
