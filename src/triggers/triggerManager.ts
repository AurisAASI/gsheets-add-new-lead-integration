import {logInfo, logWarn} from '../logging/logger';

const ADDON_TITLE = 'Lead Control - Novo Lead';

export function deleteTriggersForHandler(handlerName: string): number {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  return removed;
}

export function setupChangeTrigger(): void {
  try {
    const removed = deleteTriggersForHandler('onChangeHandler');
    ScriptApp.newTrigger('onChangeHandler')
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onChange()
        .create();
    logInfo(
        'trigger',
        `Trigger onChange criado | removidos=${removed}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn('trigger', `Falha ao criar trigger onChange | ${message}`);
    throw error;
  }
}

export function removeChangeTrigger(): void {
  const removed = deleteTriggersForHandler('onChangeHandler');
  logInfo('trigger', `Triggers onChange removidos | quantidade=${removed}`);
}

export function ensureAuthorizationOrNotify(): boolean {
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);

  if (authInfo.getAuthorizationStatus() !== ScriptApp.AuthorizationStatus.REQUIRED) {
    return true;
  }

  const today = new Date().toDateString();
  const props = PropertiesService.getDocumentProperties();
  const lastAuthEmailDate = props.getProperty('lastAuthEmailDate');

  if (lastAuthEmailDate !== today && MailApp.getRemainingDailyQuota() > 0) {
    const email = Session.getEffectiveUser().getEmail();
    const authUrl = authInfo.getAuthorizationUrl();
    const body = [
      `O add-on "${ADDON_TITLE}" precisa de reautorização.`,
      '',
      'Abra o Google Planilhas e execute o add-on pelo menu Extensões,',
      'ou use o link abaixo:',
      authUrl,
    ].join('\n');

    MailApp.sendEmail(email, 'Lead Control: reautorização necessária', body);
    props.setProperty('lastAuthEmailDate', today);
    logInfo('trigger', `E-mail de reautorização enviado | destinatário=${email}`);
  } else {
    logWarn('trigger', 'Reautorização necessária — e-mail não enviado (quota ou já enviado hoje)');
  }

  return false;
}
