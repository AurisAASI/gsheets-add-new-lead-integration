/** Quiet wait after spreadsheet writes settle (ms). */
export const QUIET_WAIT_MS = 8000;

/** Max total wait before forcing a process pass (ms). */
export const QUIET_MAX_WAIT_MS = 20000;

/**
 * Returns true when this execution still owns the quiet token
 * (no newer event replaced it).
 */
export function stillOwnsQuietToken(
    currentToken: string,
    latestToken: string | null | undefined,
): boolean {
  return latestToken === currentToken;
}

/**
 * Build a unique quiet token for one onChange event.
 */
export function buildQuietToken(nowMs: number, randomSuffix: string): string {
  return `${nowMs}:${randomSuffix}`;
}

/**
 * Cap remaining sleep so total wait from startMs stays under QUIET_MAX_WAIT_MS.
 */
export function remainingQuietSleepMs(
    startMs: number,
    nowMs: number,
    quietWaitMs = QUIET_WAIT_MS,
    maxWaitMs = QUIET_MAX_WAIT_MS,
): number {
  const elapsed = Math.max(0, nowMs - startMs);
  const remainingBudget = Math.max(0, maxWaitMs - elapsed);
  return Math.min(quietWaitMs, remainingBudget);
}
