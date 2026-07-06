const LOG_PREFIX = '[LeadControl]';
const MAX_ERROR_DETAIL_LENGTH = 200;

export type LogContext =
  | 'onChange'
  | 'api'
  | 'trigger'
  | 'config'
  | 'ui'
  | 'install';

function formatMessage(context: LogContext, message: string): string {
  return `${LOG_PREFIX}[${context}] ${message}`;
}

export function truncateText(text: string, maxLength = MAX_ERROR_DETAIL_LENGTH): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}...`;
}

export function sanitizeEndpoint(url: string): string {
  if (!url) {
    return '(vazio)';
  }
  const match = url.match(/^https?:\/\/([^/?#]+)/i);
  if (match) {
    return match[1];
  }
  return truncateText(url, 80);
}

export function logInfo(context: LogContext, message: string): void {
  console.log(formatMessage(context, message));
}

export function logWarn(context: LogContext, message: string): void {
  console.warn(formatMessage(context, message));
}

export function logError(
    context: LogContext,
    message: string,
    detail?: string,
): void {
  const fullMessage = detail ?
    `${message} | ${truncateText(detail)}` :
    message;
  console.error(formatMessage(context, fullMessage));
}
