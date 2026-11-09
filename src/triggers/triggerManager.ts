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
export function setupChangeTrigger(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): boolean {
  try {
    const ss = spreadsheet || SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      logWarn('trigger', 'Falha ao criar trigger onChange | planilha ativa indisponível');
      return false;
    }

    const removed = deleteTriggersForHandler('onChangeHandler');
    ScriptApp.newTrigger('onChangeHandler')
        .forSpreadsheet(ss)
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

/**
 * Hourly safety-net sweep (add-on minimum interval is 1 hour).
 */
export function setupHourlySweepTrigger(): boolean {
  try {
    const removed = deleteTriggersForHandler('onHourlySweep');
    ScriptApp.newTrigger('onHourlySweep')
        .timeBased()
        .everyHours(1)
        .create();
    logInfo('trigger', `Trigger horário criado | removidos=${removed}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn('trigger', `Falha ao criar trigger horário | ${message}`);
    return false;
  }
}

export function removeChangeTrigger(): void {
  const removed = deleteTriggersForHandler('onChangeHandler');
  logInfo('trigger', `Triggers onChange removidos | quantidade=${removed}`);
}

export function removeHourlySweepTrigger(): void {
  const removed = deleteTriggersForHandler('onHourlySweep');
  logInfo('trigger', `Triggers horários removidos | quantidade=${removed}`);
}

export function removeAllIntegrationTriggers(): void {
  removeChangeTrigger();
  removeHourlySweepTrigger();
}

/**
 * Create onChange + hourly sweep. Returns false if onChange fails
 * (hourly failure alone is non-fatal but logged).
 */
export function setupAllIntegrationTriggers(
    spreadsheet?: GoogleAppsScript.Spreadsheet.Spreadsheet,
): boolean {
  const changeOk = setupChangeTrigger(spreadsheet);
  const hourlyOk = setupHourlySweepTrigger();
  if (!hourlyOk) {
    logWarn('trigger', 'onChange ok, mas passe horário não foi criado');
  }
  return changeOk;
}

export function ensureAuthorization(): boolean {
  const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);

  if (authInfo.getAuthorizationStatus() !== ScriptApp.AuthorizationStatus.REQUIRED) {
    return true;
  }

  logWarn('trigger', 'Reautorização necessária — execução interrompida');
  return false;
}
