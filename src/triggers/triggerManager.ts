import {logInfo, logWarn} from '../logging/logger';

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

export function ensureAuthorization(): boolean {
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);

  if (authInfo.getAuthorizationStatus() !== ScriptApp.AuthorizationStatus.REQUIRED) {
    return true;
  }

  logWarn('trigger', 'Reautorização necessária — execução interrompida');
  return false;
}
