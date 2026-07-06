const ADDON_TITLE = 'Lead Control - Novo Lead';

export function deleteTriggersForHandler(handlerName: string): void {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === handlerName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

export function setupChangeTrigger(): void {
  deleteTriggersForHandler('onChangeHandler');
  ScriptApp.newTrigger('onChangeHandler')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onChange()
      .create();
}

export function removeChangeTrigger(): void {
  deleteTriggersForHandler('onChangeHandler');
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
  }

  return false;
}
