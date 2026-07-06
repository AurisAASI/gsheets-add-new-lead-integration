import {
  getConfig,
  initializeLastProcessedRow,
  isConfigComplete,
  saveConfig,
} from '../config/settings';
import {getExpectedColumns} from '../mapping/leadMapper';
import {DEFAULT_SHEET_NAME} from '../types';
import {processLastRow} from '../triggers/onChangeHandler';
import {
  removeChangeTrigger,
  setupChangeTrigger,
} from '../triggers/triggerManager';
import {
  showErrorToast,
  showInfoToast,
  showSuccessToast,
} from './notifications';

function buildStatusSection(config: ReturnType<typeof getConfig>): GoogleAppsScript.Card_Service.CardSection {
  const statusText = config.enabled ?
    'Ativa — novas linhas serão enviadas automaticamente.' :
    'Inativa — configure e salve para ativar.';

  const lastProcessedText = config.lastProcessedRow > 0 ?
    `Última linha processada: ${config.lastProcessedRow}` :
    'Nenhuma linha processada ainda.';

  return CardService.newCardSection()
      .setHeader('Status')
      .addWidget(
          CardService.newTextParagraph().setText(statusText),
      )
      .addWidget(
          CardService.newTextParagraph().setText(lastProcessedText),
      );
}

function buildConfigSection(
    config: ReturnType<typeof getConfig>,
): GoogleAppsScript.Card_Service.CardSection {
  return CardService.newCardSection()
      .setHeader('Configuração da integração')
      .addWidget(
          CardService.newTextInput()
              .setFieldName('apiEndpoint')
              .setTitle('API Endpoint')
              .setValue(config.apiEndpoint),
      )
      .addWidget(
          CardService.newTextInput()
              .setFieldName('apiKey')
              .setTitle('API Key')
              .setValue(config.apiKey),
      )
      .addWidget(
          CardService.newTextInput()
              .setFieldName('companyId')
              .setTitle('Company ID')
              .setValue(config.companyId),
      )
      .addWidget(
          CardService.newTextInput()
              .setFieldName('sheetName')
              .setTitle('Nome da aba')
              .setValue(config.sheetName || DEFAULT_SHEET_NAME),
      );
}

function buildColumnsSection(): GoogleAppsScript.Card_Service.CardSection {
  const columns = getExpectedColumns().join(', ');
  return CardService.newCardSection()
      .setHeader('Colunas esperadas na planilha')
      .addWidget(
          CardService.newTextParagraph().setText(
              `A primeira linha deve conter os cabeçalhos: ${columns}. ` +
              'Campos obrigatórios: nome, telefone, cidade, fonte.',
          ),
      );
}

function buildActionsSection(): GoogleAppsScript.Card_Service.CardSection {
  return CardService.newCardSection()
      .setHeader('Ações')
      .addWidget(
          CardService.newTextButton()
              .setText('Salvar e ativar')
              .setOnClickAction(
                  CardService.newAction().setFunctionName('handleSaveConfiguration'),
              ),
      )
      .addWidget(
          CardService.newTextButton()
              .setText('Desativar integração')
              .setOnClickAction(
                  CardService.newAction().setFunctionName('handleDisableIntegration'),
              ),
      )
      .addWidget(
          CardService.newTextButton()
              .setText('Testar envio (última linha)')
              .setOnClickAction(
                  CardService.newAction().setFunctionName('handleTestLastRow'),
              ),
      )
      .addWidget(
          CardService.newTextButton()
              .setText('Reprocessar última linha')
              .setOnClickAction(
                  CardService.newAction().setFunctionName('handleReprocessLastRow'),
              ),
      );
}

export function buildHomepageCard(): GoogleAppsScript.Card_Service.Card {
  const config = getConfig();

  return CardService.newCardBuilder()
      .setHeader(
          CardService.newCardHeader()
              .setTitle('Lead Control')
              .setSubtitle('Integração de novos leads'),
      )
      .addSection(buildStatusSection(config))
      .addSection(buildConfigSection(config))
      .addSection(buildColumnsSection())
      .addSection(buildActionsSection())
      .build();
}

export function onSheetsHomepage(): GoogleAppsScript.Card_Service.Card {
  return buildHomepageCard();
}

export function handleSaveConfiguration(
    e: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  const formInputs = (e as {formInputs?: Record<string, string[]>}).formInputs || {};
  const apiEndpoint = String(formInputs.apiEndpoint?.[0] || '').trim();
  const apiKey = String(formInputs.apiKey?.[0] || '').trim();
  const companyId = String(formInputs.companyId?.[0] || '').trim();
  const sheetName = String(formInputs.sheetName?.[0] || DEFAULT_SHEET_NAME).trim();

  const draft = {
    apiEndpoint,
    apiKey,
    companyId,
    sheetName,
    enabled: true,
  };

  if (!isConfigComplete({...getConfig(), ...draft})) {
    showErrorToast('Preencha API Endpoint, API Key, Company ID e nome da aba.');
    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Configuração incompleta.'),
        )
        .build();
  }

  const previous = getConfig();
  saveConfig(draft);

  if (previous.lastProcessedRow === 0) {
    initializeLastProcessedRow();
  }

  setupChangeTrigger();
  showSuccessToast('Configuração salva e integração ativada.');

  return CardService.newActionResponseBuilder()
      .setNotification(
          CardService.newNotification().setText('Integração ativada com sucesso.'),
      )
      .setNavigation(
          CardService.newNavigation().updateCard(buildHomepageCard()),
      )
      .build();
}

export function handleDisableIntegration(): GoogleAppsScript.Card_Service.ActionResponse {
  saveConfig({enabled: false});
  removeChangeTrigger();
  showInfoToast('Integração desativada.');

  return CardService.newActionResponseBuilder()
      .setNotification(
          CardService.newNotification().setText('Integração desativada.'),
      )
      .setNavigation(
          CardService.newNavigation().updateCard(buildHomepageCard()),
      )
      .build();
}

export function handleTestLastRow(): GoogleAppsScript.Card_Service.ActionResponse {
  const config = getConfig();
  if (!isConfigComplete(config)) {
    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Configure a integração antes de testar.'),
        )
        .build();
  }

  const result = processLastRow();
  if (result.success) {
    showSuccessToast(result.message);
  } else {
    showErrorToast(result.message);
  }

  return CardService.newActionResponseBuilder()
      .setNotification(
          CardService.newNotification().setText(result.message),
      )
      .build();
}

export function handleReprocessLastRow(): GoogleAppsScript.Card_Service.ActionResponse {
  const config = getConfig();
  if (!isConfigComplete(config)) {
    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Configure a integração antes de reprocessar.'),
        )
        .build();
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheetName);
  if (!sheet) {
    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText(`Aba "${config.sheetName}" não encontrada.`),
        )
        .build();
  }

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Não há linhas de dados para reprocessar.'),
        )
        .build();
  }

  saveConfig({lastProcessedRow: lastRow - 1});
  const result = processLastRow();

  if (result.success) {
    saveConfig({lastProcessedRow: lastRow});
    showSuccessToast(result.message);
  } else {
    showErrorToast(result.message);
  }

  return CardService.newActionResponseBuilder()
      .setNotification(
          CardService.newNotification().setText(result.message),
      )
      .setNavigation(
          CardService.newNavigation().updateCard(buildHomepageCard()),
      )
      .build();
}
