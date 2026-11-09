import {logError, logInfo, sanitizeEndpoint, truncateText} from '../logging/logger';
import {
  classifyHttpResult,
  extractApiErrorMessage,
} from '../sync/httpClassify';
import {FETCH_BATCH_SIZE, IntegrationConfig, LeadPayload} from '../types';

export type SendLeadOutcome = 'created' | 'duplicate' | 'error';

export interface SendLeadResult {
  success: boolean;
  outcome: SendLeadOutcome;
  statusCode: number;
  message: string;
  closesRow: boolean;
  stopBatch: boolean;
}

export interface SendLeadContext {
  row?: number;
}

function formatRowContext(row?: number): string {
  return row !== undefined ? `linha=${row}` : 'linha=manual';
}

function buildFetchOptions(
    lead: LeadPayload,
    config: IntegrationConfig,
): GoogleAppsScript.URL_Fetch.URLFetchRequestOptions {
  return {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': config.apiKey,
    },
    payload: JSON.stringify(lead),
    muteHttpExceptions: true,
  };
}

function resultFromHttp(
    statusCode: number,
    responseBody: string,
    lead: LeadPayload,
): SendLeadResult {
  const classified = classifyHttpResult(statusCode, responseBody);

  if (classified.class === 'success') {
    return {
      success: true,
      outcome: 'created',
      statusCode,
      message: `Lead ${lead.fullName} enviado com sucesso.`,
      closesRow: true,
      stopBatch: false,
    };
  }

  if (classified.class === 'duplicate') {
    return {
      success: true,
      outcome: 'duplicate',
      statusCode,
      message: 'Lead já cadastrado para esta empresa (telefone duplicado).',
      closesRow: true,
      stopBatch: false,
    };
  }

  const detail = truncateText(extractApiErrorMessage(responseBody) || responseBody);
  return {
    success: false,
    outcome: 'error',
    statusCode,
    message: `Erro ${statusCode}: ${detail}`,
    closesRow: classified.closesRow,
    stopBatch: classified.stopBatch,
  };
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

  try {
    const response = UrlFetchApp.fetch(
        config.apiEndpoint,
        buildFetchOptions(lead, config),
    );
    const statusCode = response.getResponseCode();
    const responseBody = response.getContentText();
    const result = resultFromHttp(statusCode, responseBody, lead);

    if (result.success) {
      logInfo(
          'api',
          `Lead ${result.outcome === 'duplicate' ? 'já existente' : 'enviado'} | ` +
          `${rowLabel} | status=${statusCode}`,
      );
    } else {
      logError('api', `Falha HTTP | ${rowLabel} | status=${statusCode}`, responseBody);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('api', `Falha na requisição | ${rowLabel}`, message);
    const classified = classifyHttpResult(0);
    return {
      success: false,
      outcome: 'error',
      statusCode: 0,
      message: `Falha na requisição: ${message}`,
      closesRow: classified.closesRow,
      stopBatch: classified.stopBatch,
    };
  }
}

export interface BatchLeadRequest {
  row: number;
  lead: LeadPayload;
}

/**
 * POST many leads with UrlFetchApp.fetchAll (chunks of FETCH_BATCH_SIZE).
 * Stops issuing further chunks if an auth error is seen.
 */
export function sendLeadsBatch(
    requests: BatchLeadRequest[],
    config: IntegrationConfig,
): SendLeadResult[] {
  const results: SendLeadResult[] = [];
  if (requests.length === 0) {
    return results;
  }

  for (let offset = 0; offset < requests.length; offset += FETCH_BATCH_SIZE) {
    const chunk = requests.slice(offset, offset + FETCH_BATCH_SIZE);
    const fetchRequests = chunk.map((item) => ({
      url: config.apiEndpoint,
      ...buildFetchOptions(item.lead, config),
    }));

    let responses: GoogleAppsScript.URL_Fetch.HTTPResponse[];
    try {
      responses = UrlFetchApp.fetchAll(fetchRequests);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      chunk.forEach((item) => {
        logError('api', `Falha no lote | linha=${item.row}`, message);
        const classified = classifyHttpResult(0);
        results.push({
          success: false,
          outcome: 'error',
          statusCode: 0,
          message: `Falha na requisição: ${message}`,
          closesRow: classified.closesRow,
          stopBatch: classified.stopBatch,
        });
      });
      break;
    }

    let stop = false;
    chunk.forEach((item, index) => {
      const response = responses[index];
      const statusCode = response.getResponseCode();
      const responseBody = response.getContentText();
      const result = resultFromHttp(statusCode, responseBody, item.lead);
      if (!result.success) {
        logError(
            'api',
            `Falha HTTP | linha=${item.row} | status=${statusCode}`,
            responseBody,
        );
      } else {
        logInfo(
            'api',
            `Lead ${result.outcome === 'duplicate' ? 'já existente' : 'enviado'} | ` +
            `linha=${item.row} | status=${statusCode}`,
        );
      }
      results.push(result);
      if (result.stopBatch) {
        stop = true;
      }
    });

    if (stop) {
      break;
    }
  }

  return results;
}
