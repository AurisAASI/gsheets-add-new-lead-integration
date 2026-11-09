import {getConfig, isConfigComplete} from './config/settings';
import {logError, logInfo} from './logging/logger';
import {ensureHistorySheet} from './logging/requestLog';
import {
  handleDisableIntegration,
  handleOpenHistory,
  handleRefreshColumns,
  handleReprocessLastRow,
  handleReprocessUnsent,
  handleSaveConfiguration,
  handleTestLastRow,
  onSheetsHomepage,
} from './ui/homepage';
import {onChangeHandler, onHourlySweep} from './triggers/onChangeHandler';
import {setupAllIntegrationTriggers} from './triggers/triggerManager';

declare const globalThis: Record<string, unknown>;

function onInstall(_e: GoogleAppsScript.Events.SheetsOnOpen): void {
  try {
    const config = getConfig();
    if (config.enabled && isConfigComplete(config)) {
      ensureHistorySheet();
      const ok = setupAllIntegrationTriggers();
      logInfo(
          'install',
          ok ?
            'onInstall concluído | triggers onChange + horário configurados' :
            'onInstall concluído | falha ao configurar triggers',
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
  onHourlySweep,
  handleSaveConfiguration,
  handleDisableIntegration,
  handleRefreshColumns,
  handleTestLastRow,
  handleReprocessLastRow,
  handleReprocessUnsent,
  handleOpenHistory,
};

Object.entries(exportedFunctions).forEach(([name, fn]) => {
  globalThis[name] = fn;
});
