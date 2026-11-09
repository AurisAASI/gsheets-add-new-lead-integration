import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {isRelevantChangeType} from '../src/sync/changeTypes.ts';
import {
  buildQuietToken,
  remainingQuietSleepMs,
  stillOwnsQuietToken,
  QUIET_WAIT_MS,
  QUIET_MAX_WAIT_MS,
} from '../src/sync/quietPeriod.ts';
import {
  classifyHttpResult,
  extractApiErrorMessage,
  isDuplicateResponse,
} from '../src/sync/httpClassify.ts';
import {sanitizePhoneCell} from '../src/sync/phoneSanitize.ts';
import {sanitizeStatusLead} from '../src/sync/statusSanitize.ts';
import {
  clampSettledThrough,
  closeRowAndAdvance,
  listCandidateRows,
  migrateFromLastProcessedRow,
  upsertOpenRow,
} from '../src/sync/cursor.ts';
import {
  decideIncompleteRow,
  INCOMPLETE_GRACE_MS,
  lastNDataRows,
  selectUnsentRows,
} from '../src/sync/rowOutcome.ts';

describe('changeTypes', () => {
  it('accepts EDIT, INSERT_ROW, OTHER', () => {
    assert.equal(isRelevantChangeType('EDIT'), true);
    assert.equal(isRelevantChangeType('INSERT_ROW'), true);
    assert.equal(isRelevantChangeType('OTHER'), true);
  });

  it('rejects FORMAT and structural changes', () => {
    assert.equal(isRelevantChangeType('FORMAT'), false);
    assert.equal(isRelevantChangeType('INSERT_COLUMN'), false);
    assert.equal(isRelevantChangeType('REMOVE_ROW'), false);
  });
});

describe('quietPeriod', () => {
  it('keeps ownership only for matching token', () => {
    const token = buildQuietToken(1000, 'abc');
    assert.equal(stillOwnsQuietToken(token, token), true);
    assert.equal(stillOwnsQuietToken(token, '1001:xyz'), false);
    assert.equal(stillOwnsQuietToken(token, null), false);
  });

  it('caps remaining sleep under max wait', () => {
    assert.equal(remainingQuietSleepMs(0, 0), QUIET_WAIT_MS);
    assert.equal(
        remainingQuietSleepMs(0, QUIET_MAX_WAIT_MS - 1000),
        1000,
    );
    assert.equal(remainingQuietSleepMs(0, QUIET_MAX_WAIT_MS), 0);
  });
});

describe('httpClassify', () => {
  it('treats 200/201 as success that closes the row', () => {
    const r = classifyHttpResult(201);
    assert.equal(r.class, 'success');
    assert.equal(r.closesRow, true);
    assert.equal(r.stopBatch, false);
  });

  it('treats 409 already exists as duplicate', () => {
    assert.equal(
        isDuplicateResponse(
            409,
            JSON.stringify({
              error: {
                message:
                  'A lead with this phone number already exists for this company',
              },
            }),
        ),
        true,
    );
    const r = classifyHttpResult(
        409,
        JSON.stringify({
          error: {
            message:
              'A lead with this phone number already exists for this company',
          },
        }),
    );
    assert.equal(r.class, 'duplicate');
    assert.equal(r.closesRow, true);
  });

  it('closes on 400 and continues the batch', () => {
    const r = classifyHttpResult(400, '{"error":{"code":"INVALID_PHONE"}}');
    assert.equal(r.class, 'permanent_error');
    assert.equal(r.closesRow, true);
    assert.equal(r.stopBatch, false);
  });

  it('stops the batch on 401/403 without closing', () => {
    const r = classifyHttpResult(401);
    assert.equal(r.class, 'auth_error');
    assert.equal(r.closesRow, false);
    assert.equal(r.stopBatch, true);
  });

  it('retries on 500 and network failure', () => {
    assert.equal(classifyHttpResult(500).closesRow, false);
    assert.equal(classifyHttpResult(429).closesRow, false);
    assert.equal(classifyHttpResult(0).closesRow, false);
  });

  it('extracts nested error.code and error.message', () => {
    assert.equal(
        extractApiErrorMessage(
            JSON.stringify({
              error: {code: 'INVALID_PHONE', message: 'Bad phone'},
            }),
        ),
        'INVALID_PHONE: Bad phone',
    );
  });
});

describe('phoneSanitize', () => {
  it('strips Meta p: and tel: prefixes', () => {
    assert.equal(sanitizePhoneCell('p:+55 11 99999-9999'), '+55 11 99999-9999');
    assert.equal(sanitizePhoneCell('tel:11999998888'), '11999998888');
  });

  it('converts numeric cells without scientific notation', () => {
    assert.equal(sanitizePhoneCell(5511999998888), '5511999998888');
    assert.equal(sanitizePhoneCell('5.511999998888e12'), '5511999998888');
  });
});

describe('statusSanitize', () => {
  it('keeps canonical statuses', () => {
    assert.equal(
        sanitizeStatusLead('Agendamento realizado').statusLead,
        'Agendamento realizado',
    );
    assert.equal(sanitizeStatusLead('Agendamento realizado').usedDefault, false);
  });

  it('falls back to Aguardando contato for unknown values', () => {
    const r = sanitizeStatusLead('NEW');
    assert.equal(r.statusLead, 'Aguardando contato');
    assert.equal(r.usedDefault, true);
    assert.equal(r.original, 'NEW');
  });
});

describe('cursor', () => {
  it('migrates lastProcessedRow', () => {
    assert.deepEqual(migrateFromLastProcessedRow(12), {
      settledThrough: 12,
      openRows: {},
    });
  });

  it('does not advance settledThrough past a pending hole', () => {
    let cursor = migrateFromLastProcessedRow(3);
    cursor = upsertOpenRow(cursor, 4, {
      state: 'pending',
      firstSeenIncompleteMs: 1,
    });
    cursor = closeRowAndAdvance({
      cursor,
      row: 5,
      state: 'sent',
    });
    assert.equal(cursor.settledThrough, 3);
    assert.equal(cursor.openRows['5']?.state, 'sent');
    assert.equal(cursor.openRows['4']?.state, 'pending');
  });

  it('advances through consecutive closed rows', () => {
    let cursor = migrateFromLastProcessedRow(3);
    cursor = closeRowAndAdvance({cursor, row: 4, state: 'sent'});
    cursor = closeRowAndAdvance({cursor, row: 5, state: 'duplicate'});
    assert.equal(cursor.settledThrough, 5);
    assert.deepEqual(cursor.openRows, {});
  });

  it('lists candidates below a pending incomplete row', () => {
    let cursor = migrateFromLastProcessedRow(1);
    cursor = upsertOpenRow(cursor, 2, {
      state: 'pending',
      firstSeenIncompleteMs: 1,
    });
    const rows = listCandidateRows(cursor, 4, 1);
    assert.deepEqual(rows, [2, 3, 4]);
  });

  it('clamps when sheet shrinks', () => {
    assert.equal(clampSettledThrough(20, 5, 1), 5);
  });
});

describe('rowOutcome', () => {
  it('keeps incomplete rows pending inside the grace window', () => {
    const decision = decideIncompleteRow(1000, undefined, INCOMPLETE_GRACE_MS);
    assert.equal(decision.action, 'pending');
  });

  it('ignores incomplete rows after the grace window', () => {
    const decision = decideIncompleteRow(
        INCOMPLETE_GRACE_MS + 10,
        {state: 'pending', firstSeenIncompleteMs: 0},
        INCOMPLETE_GRACE_MS,
    );
    assert.equal(decision.action, 'ignored');
  });

  it('selects only unsent rows among the last 50', () => {
    const rows = lastNDataRows(55, 1, 50);
    assert.equal(rows[0], 6);
    assert.equal(rows[rows.length - 1], 55);

    const latest = new Map([
      [54, 'Sucesso' as const],
      [53, 'Duplicado' as const],
      [52, 'Erro' as const],
    ]);
    const selected = selectUnsentRows(rows, latest);
    assert.equal(selected.includes(54), false);
    assert.equal(selected.includes(53), false);
    assert.equal(selected.includes(52), true);
    assert.equal(selected.includes(55), true);
  });
});
