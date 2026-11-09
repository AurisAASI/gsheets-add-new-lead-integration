# AI Context — Lead Control Google Sheets Add-on

> Documento otimizado para assistentes de IA (Cursor, ChatGPT, Claude, etc.) manterem e evoluírem este projeto.

## Purpose

Google Workspace Add-on for Google Sheets that automatically sends new lead rows to the Lead Control API (`POST /integrations/leads`) when rows are appended to a configured sheet tab — typically by paid traffic integrations (Meta Lead Ads, Google Ads, Zapier, Make) writing via the Google Sheets API. Configuration (API endpoint, API key, company ID, sheet name) is stored per-spreadsheet in DocumentProperties and set via a CardService sidebar UI.

## Tech stack

- **Runtime:** Google Apps Script (V8)
- **Language:** TypeScript → esbuild bundle → single `dist/Code.js`
- **CLI:** clasp 3.x for push/deploy
- **UI:** CardService (Google Workspace Add-on framework)
- **Triggers:** Installable `onChange` + hourly `onHourlySweep` (NOT `onEdit`)
- **Tests:** `node:test` via `tsx` on pure modules under `src/sync/`

## File map

| Path | Responsibility |
|------|----------------|
| `src/main.ts` | Entry point; assigns functions to `globalThis` for GAS |
| `src/appsscript.json` | Manifest: OAuth scopes, add-on name, homepageTrigger |
| `src/types.ts` | Shared types, constants, property keys |
| `src/config/settings.ts` | DocumentProperties only (+ one-time UserProperties migrate) |
| `src/mapping/leadMapper.ts` | Map columns → API payload (phone/status sanitize) |
| `src/api/leadClient.ts` | `UrlFetchApp.fetch` / `fetchAll` POST to Lead Control |
| `src/sync/*` | Pure sync logic + `processPendingRows` engine |
| `src/logging/logger.ts` | Stackdriver / Executions logging |
| `src/logging/requestLog.ts` | History sheet (batch append) |
| `src/triggers/triggerManager.ts` | Create/delete onChange + hourly triggers |
| `src/triggers/onChangeHandler.ts` | Quiet-period token wait + handlers |
| `src/ui/homepage.ts` | CardService config UI + action handlers |
| `test/sync.test.ts` | Pure-function tests |
| `scripts/build.mjs` | esbuild + copy appsscript.json to dist |
| `scripts/verify-build.mjs` | Verify exported global functions exist in bundle |

## Invariants — DO NOT BREAK

1. **Use `onChange`, never `onEdit`** for detecting API-appended rows; accept **`OTHER`**
2. **Never hardcode** API keys, endpoints, or company IDs — only DocumentProperties
3. **Global functions** MUST be assigned to `globalThis` in `main.ts`
4. **Cursor** is `settledThrough` + `openRows` (migrate from legacy `lastProcessedRow`)
5. **Installable triggers** must be created with `ScriptApp.newTrigger`
6. **`clasp push` ≠ deploy** — Marketplace users see `clasp deploy` versions
7. **Required API fields:** `fullName`, `phone`, `city`, `companyID`, `source`
8. **Column mapping** is case-insensitive
9. **409 already exists** closes the row as Duplicado (idempotent)
10. **Never monitor `Lead Control - Histórico`** as the source sheet
11. **Single engine** `processPendingRows` for onChange, hourly, and reprocess-50
12. **Quiet token wait** (~8s) — never drop subsequent events without a later pass
13. **Incomplete rows** stay pending for 3 minutes before Ignorado; do not block complete rows below
14. **400** closes that row and continues; **401/403** stop the batch; **5xx/0** retry

## Data flow

```
External integration → Sheets API append row
  → onChange (EDIT | INSERT_ROW | OTHER)
  → set quiet token → sleep ~8s → owner processes
  → processPendingRows (document lock)
  → map + sanitize → fetchAll POST
  → appendRequestLogBatch → save settledThrough/openRows
  → toast feedback

Hourly / Reprocess 50 → same processPendingRows
```

## Common tasks

### Debug automatic send

- Executions log: look for `changeType=OTHER`, `Token quieto`, `Lote concluído`
- History tab: Sucesso / Duplicado / Erro / Ignorado
- Confirm triggers: onChangeHandler + onHourlySweep
- `npm run logs:dev`

### Deploy

```bash
npm run verify
npm run push:dev      # develop / test deployment
npm run deploy:prod   # main / Marketplace (approval)
```

## Build commands

```bash
npm test
npm run build
npm run verify   # test + build + export check
npm run push:dev
npm run deploy:prod
```
