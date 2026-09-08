function getActiveSpreadsheetSafe(): GoogleAppsScript.Spreadsheet.Spreadsheet | null {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch {
    return null;
  }
}

function toastSafe(message: string, title: string, seconds: number): void {
  const ss = getActiveSpreadsheetSafe();
  if (!ss) {
    return;
  }
  ss.toast(message, title, seconds);
}

export function showSuccessToast(message: string): void {
  toastSafe(message, 'Sucesso', 5);
}

export function showErrorToast(message: string): void {
  toastSafe(message, 'Erro', 8);
}

export function showInfoToast(message: string): void {
  toastSafe(message, 'Lead Control', 5);
}

export function showWarningToast(message: string): void {
  toastSafe(message, 'Aviso', 6);
}
