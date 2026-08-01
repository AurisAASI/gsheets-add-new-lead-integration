import {
  getConfig,
  initializeLastProcessedRow,
  isColumnMappingComplete,
  isConfigComplete,
  saveConfig,
} from '../config/settings';
import {logError, logInfo, logWarn} from '../logging/logger';
import {
  FIELD_LABELS_PT,
  getSheetHeaders,
  UNMAPPED_OPTION,
} from '../mapping/leadMapper';
import {
  ColumnMappings,
  DEFAULT_SHEET_NAME,
  IntegrationConfig,
  MappableLeadField,
} from '../types';
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

const LEAD_CONTROL_URL = 'https://app.leadcontrol.ia.br';
const ADDON_TITLE = 'Lead Control - Adicionar novo lead';

const COLUMN_FIELD_CONFIG: Array<{
  key: MappableLeadField;
  fieldName: string;
  required: boolean;
}> = [
  {key: 'fullName', fieldName: 'mapFullName', required: true},
  {key: 'phone', fieldName: 'mapPhone', required: true},
  {key: 'city', fieldName: 'mapCity', required: true},
  {key: 'source', fieldName: 'mapSource', required: true},
  {key: 'email', fieldName: 'mapEmail', required: false},
  {key: 'statusLead', fieldName: 'mapStatusLead', required: false},
];

function getActiveSpreadsheetSafe(): GoogleAppsScript.Spreadsheet.Spreadsheet | null {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch {
    return null;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildErrorCard(message: string): GoogleAppsScript.Card_Service.Card {
  return CardService.newCardBuilder()
      .setHeader(
          CardService.newCardHeader()
              .setTitle(ADDON_TITLE)
              .setSubtitle('Não foi possível carregar o painel'),
      )
      .addSection(
          CardService.newCardSection()
              .addWidget(
                  CardService.newTextParagraph().setText(
                      'Algo deu errado ao abrir o add-on. Feche o painel e abra ' +
                      'novamente pela planilha (Extensões). Se o problema continuar, ' +
                      'contate o suporte Lead Control.',
                  ),
              )
              .addWidget(
                  CardService.newTextParagraph().setText(`Detalhe: ${message}`),
              ),
      )
      .build();
}

function notificationResponse(
    text: string,
): GoogleAppsScript.Card_Service.ActionResponse {
  return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(text))
      .build();
}

function buildIntroSection(): GoogleAppsScript.Card_Service.CardSection {
  return CardService.newCardSection()
      .addWidget(
          CardService.newTextParagraph().setText(
              'Este add-on monitora a aba configurada e envia cada nova linha ' +
              'como lead para o Lead Control, linha a linha, assim que ela é ' +
              'adicionada à planilha.',
          ),
      );
}

function buildStatusSection(
    config: IntegrationConfig,
): GoogleAppsScript.Card_Service.CardSection {
  const section = CardService.newCardSection().setHeader('Status');

  if (config.enabled) {
    section.addWidget(
        CardService.newDecoratedText()
            .setTopLabel('Integração ativa')
            .setText('Novas linhas serão enviadas automaticamente para o Lead Control.')
            .setWrapText(true)
            .setStartIcon(
                CardService.newIconImage().setIcon(CardService.Icon.STAR),
            ),
    );
  } else {
    section.addWidget(
        CardService.newDecoratedText()
            .setTopLabel('Integração inativa')
            .setText('Configure e clique em Salvar e ativar para começar.')
            .setWrapText(true)
            .setStartIcon(
                CardService.newIconImage().setIcon(CardService.Icon.CLOCK),
            ),
    );
  }

  const credentialsText = isConfigComplete(config) ?
    'Credenciais: preenchidas' :
    'Credenciais: incompletas';

  const lastProcessedText = config.lastProcessedRow > 0 ?
    `Última linha processada: ${config.lastProcessedRow}` :
    'Nenhuma linha processada ainda.';

  section.addWidget(
      CardService.newDecoratedText()
          .setText(`${credentialsText}\n${lastProcessedText}`)
          .setWrapText(true)
          .setStartIcon(
              CardService.newIconImage().setIcon(
                  isConfigComplete(config) ?
                    CardService.Icon.PERSON :
                    CardService.Icon.DESCRIPTION,
              ),
          ),
  );

  return section;
}

function buildLeadControlNoticeSection(): GoogleAppsScript.Card_Service.CardSection {
  return CardService.newCardSection()
      .addWidget(
          CardService.newDecoratedText()
              .setText(
                  'URL do endpoint, Chave de API, ID da Empresa e demais credenciais ' +
                  'estão em Configurações → Integração no Lead Control.',
              )
              .setWrapText(true)
              .setBottomLabel('Abrir Lead Control')
              .setOpenLink(
                  CardService.newOpenLink().setUrl(LEAD_CONTROL_URL),
              ),
      );
}

function buildConfigSection(
    config: IntegrationConfig,
): GoogleAppsScript.Card_Service.CardSection {
  return CardService.newCardSection()
      .setHeader('Configuração da integração')
      .addWidget(
          CardService.newTextInput()
              .setFieldName('apiEndpoint')
              .setTitle('URL do endpoint')
              .setValue(config.apiEndpoint),
      )
      .addWidget(
          CardService.newTextInput()
              .setFieldName('apiKey')
              .setTitle('Chave de API')
              .setValue(config.apiKey),
      )
      .addWidget(
          CardService.newTextInput()
              .setFieldName('companyId')
              .setTitle('ID da empresa')
              .setValue(config.companyId),
      )
      .addWidget(
          CardService.newTextInput()
              .setFieldName('sheetName')
              .setTitle('Nome da aba')
              .setValue(config.sheetName || DEFAULT_SHEET_NAME),
      );
}

function buildColumnDropdown(
    field: MappableLeadField,
    formFieldName: string,
    required: boolean,
    headers: string[],
    selectedValue: string,
): GoogleAppsScript.Card_Service.SelectionInput {
  const label = FIELD_LABELS_PT[field];
  const title = required ? `${label} (obrigatório)` : `${label} (opcional)`;
  const selection = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setTitle(title)
      .setFieldName(formFieldName);

  if (!required) {
    const isUnmapped = !selectedValue;
    selection.addItem(UNMAPPED_OPTION, '', isUnmapped);
  }

  const headerOptions = [...headers];
  if (selectedValue && !headerOptions.includes(selectedValue)) {
    headerOptions.unshift(selectedValue);
  }

  headerOptions.forEach((header) => {
    selection.addItem(header, header, header === selectedValue);
  });

  if (required && headers.length > 0 && !selectedValue) {
    selection.addItem('— Selecione —', '', true);
  }

  if (required && headers.length === 0 && !selectedValue) {
    selection.addItem('— Selecione —', '', true);
  }

  return selection;
}

function buildColumnMappingSection(
    config: IntegrationConfig,
): GoogleAppsScript.Card_Service.CardSection {
  const section = CardService.newCardSection()
      .setHeader('Mapeamento de colunas')
      .addWidget(
          CardService.newTextParagraph().setText(
              'Selecione qual coluna da planilha corresponde a cada informação do lead.',
          ),
      );

  const spreadsheet = getActiveSpreadsheetSafe();
  if (!spreadsheet) {
    section.addWidget(
        CardService.newTextParagraph().setText(
            'Abra o add-on a partir de uma planilha do Google Sheets™ para mapear as colunas.',
        ),
    );
    return section;
  }

  const sheet = spreadsheet.getSheetByName(config.sheetName);
  if (!sheet) {
    section.addWidget(
        CardService.newTextParagraph().setText(
            `Aba "${config.sheetName}" não encontrada. Verifique o nome da aba e clique em Atualizar colunas.`,
        ),
    );
    return section;
  }

  const headers = getSheetHeaders(sheet);
  if (headers.length === 0) {
    section.addWidget(
        CardService.newTextParagraph().setText(
            'Nenhuma coluna detectada na linha 1. Adicione cabeçalhos e clique em Atualizar colunas.',
        ),
    );
    return section;
  }

  COLUMN_FIELD_CONFIG.forEach(({key, fieldName, required}) => {
    const selectedValue = config.columnMappings[key] || '';
    section.addWidget(
        buildColumnDropdown(key, fieldName, required, headers, selectedValue),
    );
  });

  section.addWidget(
      CardService.newTextButton()
          .setText('Atualizar colunas')
          .setOnClickAction(
              CardService.newAction().setFunctionName('handleRefreshColumns'),
          ),
  );

  return section;
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

function resolveDisplayConfig(
    overrides?: Partial<IntegrationConfig>,
): IntegrationConfig {
  return {...getConfig(), ...overrides};
}

export function buildHomepageCard(
    overrides?: Partial<IntegrationConfig>,
): GoogleAppsScript.Card_Service.Card {
  const config = resolveDisplayConfig(overrides);

  return CardService.newCardBuilder()
      .setHeader(
          CardService.newCardHeader()
              .setTitle(ADDON_TITLE)
              .setSubtitle('Ponte entre planilha e Lead Control'),
      )
      .addSection(buildIntroSection())
      .addSection(buildStatusSection(config))
      .addSection(buildLeadControlNoticeSection())
      .addSection(buildConfigSection(config))
      .addSection(buildColumnMappingSection(config))
      .addSection(buildActionsSection())
      .build();
}

export function onSheetsHomepage(): GoogleAppsScript.Card_Service.Card {
  try {
    return buildHomepageCard();
  } catch (error) {
    const message = errorMessage(error);
    logError('ui', `Falha ao montar homepage | ${message}`);
    return buildErrorCard(message);
  }
}

function parseColumnMappingsFromForm(
    formInputs: Record<string, string[]>,
): ColumnMappings {
  return {
    fullName: String(formInputs.mapFullName?.[0] || '').trim(),
    phone: String(formInputs.mapPhone?.[0] || '').trim(),
    city: String(formInputs.mapCity?.[0] || '').trim(),
    source: String(formInputs.mapSource?.[0] || '').trim(),
    email: String(formInputs.mapEmail?.[0] || '').trim(),
    statusLead: String(formInputs.mapStatusLead?.[0] || '').trim(),
  };
}

function getFormOverrides(
    e: GoogleAppsScript.Addons.EventObject,
): Partial<IntegrationConfig> {
  const formInputs = (e as {formInputs?: Record<string, string[]>}).formInputs || {};
  return {
    apiEndpoint: String(formInputs.apiEndpoint?.[0] || '').trim(),
    apiKey: String(formInputs.apiKey?.[0] || '').trim(),
    companyId: String(formInputs.companyId?.[0] || '').trim(),
    sheetName: String(formInputs.sheetName?.[0] || DEFAULT_SHEET_NAME).trim(),
    columnMappings: parseColumnMappingsFromForm(formInputs),
  };
}

export function handleRefreshColumns(
    e: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const overrides = getFormOverrides(e);
    const displayConfig = resolveDisplayConfig(overrides);

    return CardService.newActionResponseBuilder()
        .setNavigation(
            CardService.newNavigation().updateCard(
                buildHomepageCard({
                  ...overrides,
                  sheetName: overrides.sheetName || displayConfig.sheetName,
                }),
            ),
        )
        .build();
  } catch (error) {
    const message = errorMessage(error);
    logError('ui', `Falha ao atualizar colunas | ${message}`);
    return notificationResponse('Não foi possível atualizar as colunas. Tente novamente.');
  }
}

export function handleSaveConfiguration(
    e: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const formInputs = (e as {formInputs?: Record<string, string[]>}).formInputs || {};
    const apiEndpoint = String(formInputs.apiEndpoint?.[0] || '').trim();
    const apiKey = String(formInputs.apiKey?.[0] || '').trim();
    const companyId = String(formInputs.companyId?.[0] || '').trim();
    const sheetName = String(formInputs.sheetName?.[0] || DEFAULT_SHEET_NAME).trim();
    const columnMappings = parseColumnMappingsFromForm(formInputs);

    const draft: Partial<IntegrationConfig> = {
      apiEndpoint,
      apiKey,
      companyId,
      sheetName,
      columnMappings,
      enabled: true,
    };

    const merged = {...getConfig(), ...draft};

    if (!isConfigComplete(merged)) {
      logWarn('ui', 'Salvar configuração rejeitado | credenciais incompletas');
      showErrorToast('Preencha URL do endpoint, Chave de API, ID da empresa e nome da aba.');
      return notificationResponse('Configuração incompleta.');
    }

    if (!isColumnMappingComplete(merged)) {
      const missingLabels = COLUMN_FIELD_CONFIG
          .filter(({key, required}) => required && !columnMappings[key])
          .map(({key}) => FIELD_LABELS_PT[key])
          .join(', ');
      logWarn('ui', `Salvar configuração rejeitado | mapeamento incompleto: ${missingLabels}`);
      showErrorToast(`Mapeie as colunas obrigatórias: ${missingLabels}.`);
      return notificationResponse('Mapeamento de colunas incompleto.');
    }

    const previous = getConfig();
    saveConfig(draft);

    let initializedRow = previous.lastProcessedRow;
    if (previous.lastProcessedRow === 0) {
      initializedRow = initializeLastProcessedRow();
    }

    const triggerOk = setupChangeTrigger();
    if (!triggerOk) {
      saveConfig({enabled: false});
      logWarn('ui', 'Configuração salva, mas trigger onChange não foi criado');
      showErrorToast(
          'Credenciais salvas, mas não foi possível ativar o monitoramento. ' +
          'Autorize o add-on novamente e clique em Salvar e ativar.',
      );
      return CardService.newActionResponseBuilder()
          .setNotification(
              CardService.newNotification().setText(
                  'Não foi possível ativar o monitoramento automático.',
              ),
          )
          .setNavigation(
              CardService.newNavigation().updateCard(buildHomepageCard()),
          )
          .build();
    }

    logInfo(
        'ui',
        `Configuração salva e ativada | aba=${sheetName} | ` +
        `lastProcessedRow=${initializedRow}`,
    );
    showSuccessToast('Configuração salva e integração ativada.');

    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Integração ativada com sucesso.'),
        )
        .setNavigation(
            CardService.newNavigation().updateCard(buildHomepageCard()),
        )
        .build();
  } catch (error) {
    const message = errorMessage(error);
    logError('ui', `Falha ao salvar configuração | ${message}`);
    showErrorToast('Não foi possível salvar a configuração. Tente novamente.');
    return notificationResponse('Não foi possível salvar a configuração.');
  }
}

export function handleDisableIntegration(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    saveConfig({enabled: false});
    removeChangeTrigger();
    logInfo('ui', 'Integração desativada pelo usuário');
    showInfoToast('Integração desativada.');

    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Integração desativada.'),
        )
        .setNavigation(
            CardService.newNavigation().updateCard(buildHomepageCard()),
        )
        .build();
  } catch (error) {
    const message = errorMessage(error);
    logError('ui', `Falha ao desativar integração | ${message}`);
    return notificationResponse('Não foi possível desativar a integração.');
  }
}

export function handleTestLastRow(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const config = getConfig();
    if (!isConfigComplete(config)) {
      return notificationResponse('Configure a integração antes de testar.');
    }

    const result = processLastRow();
    if (result.success) {
      if (result.outcome === 'duplicate') {
        logInfo('ui', `Teste de envio concluído (duplicado) | ${result.message}`);
        showInfoToast(result.message);
      } else {
        logInfo('ui', `Teste de envio concluído | ${result.message}`);
        showSuccessToast(result.message);
      }
    } else {
      logError('ui', `Teste de envio falhou | ${result.message}`);
      showErrorToast(result.message);
    }

    return notificationResponse(result.message);
  } catch (error) {
    const message = errorMessage(error);
    logError('ui', `Falha no teste de envio | ${message}`);
    showErrorToast('Não foi possível testar o envio.');
    return notificationResponse('Não foi possível testar o envio.');
  }
}

export function handleReprocessLastRow(): GoogleAppsScript.Card_Service.ActionResponse {
  try {
    const config = getConfig();
    if (!isConfigComplete(config)) {
      return notificationResponse('Configure a integração antes de reprocessar.');
    }

    const spreadsheet = getActiveSpreadsheetSafe();
    if (!spreadsheet) {
      return notificationResponse('Abra o add-on a partir de uma planilha para reprocessar.');
    }

    const sheet = spreadsheet.getSheetByName(config.sheetName);
    if (!sheet) {
      return notificationResponse(`Aba "${config.sheetName}" não encontrada.`);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return notificationResponse('Não há linhas de dados para reprocessar.');
    }

    saveConfig({lastProcessedRow: lastRow - 1});
    const result = processLastRow();

    if (result.success) {
      saveConfig({lastProcessedRow: lastRow});
      if (result.outcome === 'duplicate') {
        logInfo('ui', `Reprocessamento concluído (duplicado) | linha=${lastRow} | ${result.message}`);
        showInfoToast(result.message);
      } else {
        logInfo('ui', `Reprocessamento concluído | linha=${lastRow} | ${result.message}`);
        showSuccessToast(result.message);
      }
    } else {
      logError('ui', `Reprocessamento falhou | linha=${lastRow} | ${result.message}`);
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
  } catch (error) {
    const message = errorMessage(error);
    logError('ui', `Falha no reprocessamento | ${message}`);
    showErrorToast('Não foi possível reprocessar a última linha.');
    return notificationResponse('Não foi possível reprocessar a última linha.');
  }
}
