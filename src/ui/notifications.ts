export function showSuccessToast(message: string): void {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, 'Sucesso', 5);
}

export function showErrorToast(message: string): void {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, 'Erro', 8);
}

export function showInfoToast(message: string): void {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, 'Lead Control', 5);
}

export function showWarningToast(message: string): void {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, 'Aviso', 6);
}
