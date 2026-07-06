import {logError, logInfo, sanitizeEndpoint, truncateText} from '../logging/logger';
import {IntegrationConfig, LeadPayload} from '../types';

export type SendLeadOutcome = 'created' | 'duplicate' | 'error';

export interface SendLeadResult {
  success: boolean;
  outcome: SendLeadOutcome;
  statusCode: number;
  message: string;
}

export interface SendLeadContext {
  row?: number;
}

interface IdempotentApiRule {
  statusCode: number;
  messagePattern?: RegExp;
}

const IDEMPOTENT_API_RULES: IdempotentApiRule[] = [
  {
    statusCode: 409,
    messagePattern: /already exists/i,
  },
];

function formatRowContext(row?: number): string {
  return row !== undefined ? `linha=${row}` : 'linha=manual';
}

function extractResponseMessage(responseBody: string): string {
  try {
    const parsed = JSON.parse(responseBody) as {message?: string};
    return parsed.message || responseBody;
  } catch {
    return responseBody;
  }
}

function isIdempotentApiResponse(statusCode: number, responseBody: string): boolean {
  const message = extractResponseMessage(responseBody);
  return IDEMPOTENT_API_RULES.some((rule) => {
    if (rule.statusCode !== statusCode) {
      return false;
    }
    if (rule.messagePattern && !rule.messagePattern.test(message)) {
      return false;
    }
    return true;
  });
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
        outcome: 'created',
        statusCode,
        message: `Lead ${lead.fullName} enviado com sucesso.`,
      };
    }

    if (isIdempotentApiResponse(statusCode, responseBody)) {
      logInfo('api', `Lead já existente | ${rowLabel} | status=${statusCode}`);
      return {
        success: true,
        outcome: 'duplicate',
        statusCode,
        message: 'Lead já cadastrado para esta empresa (telefone duplicado).',
      };
    }

    const errorMessage = `Erro ${statusCode}: ${truncateText(responseBody)}`;
    logError('api', `Falha HTTP | ${rowLabel} | status=${statusCode}`, responseBody);
    return {
      success: false,
      outcome: 'error',
      statusCode,
      message: errorMessage,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('api', `Falha na requisição | ${rowLabel}`, message);
    return {
      success: false,
      outcome: 'error',
      statusCode: 0,
      message: `Falha na requisição: ${message}`,
    };
  }
}
