export type HttpRowClass =
  | 'success'
  | 'duplicate'
  | 'permanent_error'
  | 'auth_error'
  | 'retryable_error';

export interface ClassifiedHttpResult {
  class: HttpRowClass;
  closesRow: boolean;
  stopBatch: boolean;
  outcome: 'created' | 'duplicate' | 'error';
}

const DUPLICATE_PATTERN = /already exists/i;

/**
 * Extract a human-readable API message from legacy or nested error bodies.
 */
export function extractApiErrorMessage(responseBody: string): string {
  try {
    const parsed = JSON.parse(responseBody) as {
      message?: string;
      error?: {code?: string; message?: string};
    };
    if (parsed.error?.message) {
      const code = parsed.error.code ? `${parsed.error.code}: ` : '';
      return `${code}${parsed.error.message}`;
    }
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // keep raw body
  }
  return responseBody;
}

export function isDuplicateResponse(
    statusCode: number,
    responseBody: string,
): boolean {
  if (statusCode !== 409) {
    return false;
  }
  const message = extractApiErrorMessage(responseBody);
  return DUPLICATE_PATTERN.test(message);
}

/**
 * Classify an HTTP (or network) result for cursor / batch decisions.
 * statusCode 0 means network / fetch failure.
 */
export function classifyHttpResult(
    statusCode: number,
    responseBody = '',
): ClassifiedHttpResult {
  if (statusCode === 200 || statusCode === 201) {
    return {
      class: 'success',
      closesRow: true,
      stopBatch: false,
      outcome: 'created',
    };
  }

  if (isDuplicateResponse(statusCode, responseBody)) {
    return {
      class: 'duplicate',
      closesRow: true,
      stopBatch: false,
      outcome: 'duplicate',
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      class: 'auth_error',
      closesRow: false,
      stopBatch: true,
      outcome: 'error',
    };
  }

  if (statusCode === 400) {
    return {
      class: 'permanent_error',
      closesRow: true,
      stopBatch: false,
      outcome: 'error',
    };
  }

  // 429, 5xx, 0 (network), and other unexpected codes → retry
  return {
    class: 'retryable_error',
    closesRow: false,
    stopBatch: false,
    outcome: 'error',
  };
}
