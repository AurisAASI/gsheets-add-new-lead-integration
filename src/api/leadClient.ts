import {IntegrationConfig, LeadPayload} from '../types';

export interface SendLeadResult {
  success: boolean;
  statusCode: number;
  message: string;
}

export function sendLeadToApi(
    lead: LeadPayload,
    config: IntegrationConfig,
): SendLeadResult {
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
      return {
        success: true,
        statusCode,
        message: `Lead ${lead.fullName} enviado com sucesso.`,
      };
    }

    return {
      success: false,
      statusCode,
      message: `Erro ${statusCode}: ${responseBody}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      statusCode: 0,
      message: `Falha na requisição: ${message}`,
    };
  }
}
