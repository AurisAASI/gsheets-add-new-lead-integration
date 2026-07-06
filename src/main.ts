import {getConfig, isConfigComplete} from './config/settings';
import {
  handleDisableIntegration,
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
  }
}

const exportedFunctions = {
  onInstall,
  onSheetsHomepage,
  onChangeHandler,
  handleSaveConfiguration,
  handleDisableIntegration,
  handleTestLastRow,
  handleReprocessLastRow,
};

Object.entries(exportedFunctions).forEach(([name, fn]) => {
  globalThis[name] = fn;
});
