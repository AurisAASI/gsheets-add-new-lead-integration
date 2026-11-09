import {OpenRowEntry} from './cursor';

/** Incomplete rows wait this long before becoming Ignored (ms). */
export const INCOMPLETE_GRACE_MS = 3 * 60 * 1000;

export type IncompleteDecision =
  | {action: 'pending'; firstSeenIncompleteMs: number}
  | {action: 'ignored'};

/**
 * Decide whether an incomplete row stays pending or becomes ignored.
 */
export function decideIncompleteRow(
    nowMs: number,
    existing: OpenRowEntry | undefined,
    graceMs = INCOMPLETE_GRACE_MS,
): IncompleteDecision {
  const firstSeen =
    existing?.firstSeenIncompleteMs ??
    (existing?.state === 'pending' ? nowMs : nowMs);

  const started =
    existing?.state === 'pending' && existing.firstSeenIncompleteMs ?
      existing.firstSeenIncompleteMs :
      firstSeen;

  if (nowMs - started >= graceMs) {
    return {action: 'ignored'};
  }
  return {action: 'pending', firstSeenIncompleteMs: started};
}

export interface HistoryRowResult {
  row: number;
  result: 'Sucesso' | 'Duplicado' | 'Erro' | 'Ignorado';
}

/**
 * From the last N data rows, pick those whose latest history result is not
 * Sucesso or Duplicado (or that have no history entry).
 */
export function selectUnsentRows(
    lastDataRows: number[],
    latestResultByRow: Map<number, HistoryRowResult['result']>,
): number[] {
  return lastDataRows.filter((row) => {
    const result = latestResultByRow.get(row);
    if (result === 'Sucesso' || result === 'Duplicado') {
      return false;
    }
    return true;
  });
}

/**
 * Build the list of the last `limit` data row numbers ending at lastRow.
 */
export function lastNDataRows(
    lastRow: number,
    headerRow: number,
    limit: number,
): number[] {
  if (lastRow <= headerRow || limit <= 0) {
    return [];
  }
  const first = Math.max(headerRow + 1, lastRow - limit + 1);
  const rows: number[] = [];
  for (let row = first; row <= lastRow; row++) {
    rows.push(row);
  }
  return rows;
}
