import {getConfig, isConfigComplete} from './config/settings';
import {logInfo} from './logging/logger';
import {
  handleDisableIntegration,
  handleRefreshColumns,
  handleReprocessLastRow,
  handleSaveConfiguration,
  handleTestLastRow,
  onSheetsHomepage,
} from './ui/homepage';
import {onChangeHandler} from './triggers/onChangeHandler';
import {setupChangeTrigger} from './triggers/triggerManager';

declare const globalThis: Record<string, unknown>;

function onInstall(_e: GoogleAppsScript.Events.SheetsOnOpen): void {
  const config = getConfig();
  if (config.enabled && isConfigComplete(config)) {
    setupChangeTrigger();
    logInfo('install', 'onInstall concluído | trigger onChange configurado');
    return;
  }

  const reason = !config.enabled ?
    'integração desativada' :
    'configuração incompleta';
  logInfo('install', `onInstall concluído | trigger ignorado (${reason})`);
}

const exportedFunctions = {
  onInstall,
  onSheetsHomepage,
  onChangeHandler,
  handleSaveConfiguration,
  handleDisableIntegration,
  handleRefreshColumns,
  handleTestLastRow,
  handleReprocessLastRow,
};

Object.entries(exportedFunctions).forEach(([name, fn]) => {
  globalThis[name] = fn;
});
