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

/**
 * Creates the installable onChange trigger.
 * Returns true on success; false if spreadsheet/auth is unavailable.
 */
export function setupChangeTrigger(): boolean {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    if (!spreadsheet) {
      logWarn('trigger', 'Falha ao criar trigger onChange | planilha ativa indisponível');
      return false;
    }

    const removed = deleteTriggersForHandler('onChangeHandler');
    ScriptApp.newTrigger('onChangeHandler')
        .forSpreadsheet(spreadsheet)
        .onChange()
        .create();
    logInfo(
        'trigger',
        `Trigger onChange criado | removidos=${removed}`,
    );
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn('trigger', `Falha ao criar trigger onChange | ${message}`);
    return false;
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
