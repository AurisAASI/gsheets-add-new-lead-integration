export type OpenRowState =
  | 'pending'
  | 'retry'
  | 'sent'
  | 'duplicate'
  | 'failed'
  | 'ignored';

export interface OpenRowEntry {
  state: OpenRowState;
  /** Epoch ms when the row was first seen incomplete (pending only). */
  firstSeenIncompleteMs?: number;
  /** Last status / message hint. */
  note?: string;
}

export type OpenRowsMap = Record<string, OpenRowEntry>;

export interface SyncCursor {
  settledThrough: number;
  openRows: OpenRowsMap;
}

export interface ApplyRowCloseInput {
  cursor: SyncCursor;
  row: number;
  state: Exclude<OpenRowState, 'pending' | 'retry'>;
  note?: string;
}

/**
 * Clamp settledThrough when the sheet shrinks.
 */
export function clampSettledThrough(
    settledThrough: number,
    lastRow: number,
    headerRow: number,
): number {
  const maxSettled = Math.max(headerRow, lastRow);
  return Math.min(settledThrough, maxSettled);
}

/**
 * Mark a row as closed (terminal). Then advance settledThrough while
 * consecutive rows after it are also closed.
 */
export function closeRowAndAdvance(input: ApplyRowCloseInput): SyncCursor {
  // Rows already covered by settledThrough need no cursor mutation
  // (e.g. safety-net reprocess of historical lines).
  if (input.row <= input.cursor.settledThrough) {
    return input.cursor;
  }

  const openRows: OpenRowsMap = {...input.cursor.openRows};
  const key = String(input.row);
  openRows[key] = {
    state: input.state,
    note: input.note,
  };

  let settledThrough = input.cursor.settledThrough;
  // Walk forward from settledThrough + 1 while rows are terminal in openRows
  // or we just closed them.
  let next = settledThrough + 1;
  while (true) {
    const entry = openRows[String(next)];
    if (!entry) {
      break;
    }
    if (
      entry.state === 'pending' ||
      entry.state === 'retry'
    ) {
      break;
    }
    // Terminal — absorb into settledThrough and drop from open map
    delete openRows[String(next)];
    settledThrough = next;
    next += 1;
  }

  return {settledThrough, openRows};
}

/**
 * Record or refresh a non-terminal open row (pending / retry).
 */
export function upsertOpenRow(
    cursor: SyncCursor,
    row: number,
    entry: OpenRowEntry,
): SyncCursor {
  return {
    settledThrough: cursor.settledThrough,
    openRows: {
      ...cursor.openRows,
      [String(row)]: entry,
    },
  };
}

/**
 * Rows that still need attention: openRows pending/retry plus every row
 * from settledThrough+1 through lastRow that is not already terminal.
 */
export function listCandidateRows(
    cursor: SyncCursor,
    lastRow: number,
    headerRow: number,
): number[] {
  const start = Math.max(cursor.settledThrough + 1, headerRow + 1);
  const rows = new Set<number>();

  for (let row = start; row <= lastRow; row++) {
    const entry = cursor.openRows[String(row)];
    if (
      entry &&
      (entry.state === 'sent' ||
        entry.state === 'duplicate' ||
        entry.state === 'failed' ||
        entry.state === 'ignored')
    ) {
      continue;
    }
    rows.add(row);
  }

  // Also include open pending/retry that might be below settledThrough due to
  // clamp edge cases (should be rare).
  Object.keys(cursor.openRows).forEach((key) => {
    const row = Number(key);
    const entry = cursor.openRows[key];
    if (
      Number.isFinite(row) &&
      row > headerRow &&
      (entry.state === 'pending' || entry.state === 'retry')
    ) {
      rows.add(row);
    }
  });

  return Array.from(rows).sort((a, b) => a - b);
}

/**
 * Migrate legacy lastProcessedRow into the new cursor shape.
 */
export function migrateFromLastProcessedRow(lastProcessedRow: number): SyncCursor {
  return {
    settledThrough: Math.max(0, lastProcessedRow),
    openRows: {},
  };
}
