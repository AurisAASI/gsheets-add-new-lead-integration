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

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(config.sheetName);
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
              .setTitle('Lead Control')
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
  return buildHomepageCard();
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
}

export function handleSaveConfiguration(
    e: GoogleAppsScript.Addons.EventObject,
): GoogleAppsScript.Card_Service.ActionResponse {
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
    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Configuração incompleta.'),
        )
        .build();
  }

  if (!isColumnMappingComplete(merged)) {
    const missingLabels = COLUMN_FIELD_CONFIG
        .filter(({key, required}) => required && !columnMappings[key])
        .map(({key}) => FIELD_LABELS_PT[key])
        .join(', ');
    logWarn('ui', `Salvar configuração rejeitado | mapeamento incompleto: ${missingLabels}`);
    showErrorToast(`Mapeie as colunas obrigatórias: ${missingLabels}.`);
    return CardService.newActionResponseBuilder()
        .setNotification(
            CardService.newNotification().setText('Mapeamento de colunas incompleto.'),
        )
        .build();
  }

  const previous = getConfig();
  saveConfig(draft);

  let initializedRow = previous.lastProcessedRow;
  if (previous.lastProcessedRow === 0) {
    initializedRow = initializeLastProcessedRow();
  }

  setupChangeTrigger();
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
}

export function handleDisableIntegration(): GoogleAppsScript.Card_Service.ActionResponse {
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
    logInfo('ui', `Teste de envio concluído | ${result.message}`);
    showSuccessToast(result.message);
  } else {
    logError('ui', `Teste de envio falhou | ${result.message}`);
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
    logInfo('ui', `Reprocessamento concluído | linha=${lastRow} | ${result.message}`);
    showSuccessToast(result.message);
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
}
