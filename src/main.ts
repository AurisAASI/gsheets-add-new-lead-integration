import {getConfig, isConfigComplete} from './config/settings';
import {logError, logInfo} from './logging/logger';
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
  try {
    const config = getConfig();
    if (config.enabled && isConfigComplete(config)) {
      const ok = setupChangeTrigger();
      logInfo(
          'install',
          ok ?
            'onInstall concluído | trigger onChange configurado' :
            'onInstall concluído | falha ao configurar trigger onChange',
      );
      return;
    }

    const reason = !config.enabled ?
      'integração desativada' :
      'configuração incompleta';
    logInfo('install', `onInstall concluído | trigger ignorado (${reason})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('install', `onInstall com erro não bloqueante | ${message}`);
  }
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
