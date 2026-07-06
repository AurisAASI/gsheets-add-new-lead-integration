# AI Context — Lead Control Google Sheets Add-on

> Documento otimizado para assistentes de IA (Cursor, ChatGPT, Claude, etc.) manterem e evoluírem este projeto.

## Purpose

Google Workspace Add-on for Google Sheets that automatically sends new lead rows to the Lead Control API (`POST /integrations/leads`) when rows are appended to a configured sheet tab — typically by paid traffic integrations (Meta Lead Ads, Google Ads, Zapier, Make) writing via the Google Sheets API. Configuration (API endpoint, API key, company ID, sheet name) is stored per-spreadsheet in DocumentProperties and set via a CardService sidebar UI.

## Tech stack

- **Runtime:** Google Apps Script (V8)
- **Language:** TypeScript → esbuild bundle → single `dist/Code.js`
- **CLI:** clasp 3.x for push/deploy
- **UI:** CardService (Google Workspace Add-on framework)
- **Trigger:** Installable `onChange` (NOT `onEdit` — API writes don't fire onEdit)

## File map

| Path | Responsibility |
|------|----------------|
| `src/main.ts` | Entry point; assigns functions to `globalThis` for GAS |
| `src/appsscript.json` | Manifest: OAuth scopes, add-on name, homepageTrigger |
| `src/types.ts` | Shared types, constants, property keys |
| `src/config/settings.ts` | Read/write DocumentProperties |
| `src/mapping/leadMapper.ts` | Map PT column headers → API payload |
| `src/api/leadClient.ts` | `UrlFetchApp.fetch` POST to Lead Control |
| `src/triggers/triggerManager.ts` | Create/delete installable onChange trigger |
| `src/triggers/onChangeHandler.ts` | Main handler: debounce, process new rows, toasts |
| `src/ui/homepage.ts` | CardService config UI + action handlers |
| `src/ui/notifications.ts` | Spreadsheet toasts |
| `scripts/build.mjs` | esbuild + copy appsscript.json to dist |
| `scripts/verify-build.mjs` | Verify exported global functions exist in bundle |
| `.clasp.dev.json` / `.clasp.prod.json` | Local clasp config (gitignored) |

## Invariants — DO NOT BREAK

1. **Use `onChange`, never `onEdit`** for detecting API-appended rows
2. **Never hardcode** API keys, endpoints, or company IDs — only DocumentProperties
3. **Global functions** (`onSheetsHomepage`, `onChangeHandler`, etc.) MUST be assigned to `globalThis` in `main.ts` — GAS invokes them by name
4. **`lastProcessedRow` cursor** prevents re-sending historical rows; initialize to `getLastRow()` on first save
5. **Installable triggers** for add-ons must be created programmatically (`ScriptApp.newTrigger`), never manually in the editor
6. **`clasp push` ≠ deploy** — Marketplace users see `clasp deploy` versions, not @HEAD
7. **Required API fields:** `fullName`, `phone`, `city`, `companyID`, `source`
8. **Column mapping** is case-insensitive: `nome`→`fullName`, `telefone`→`phone`, `cidade`→`city`, `email`→`email`, `fonte`→`source`, `status`→`statusLead`

## Data flow

```
External integration → Sheets API append row
  → onChange trigger fires
  → onChangeHandler checks auth + enabled + debounce
  → processNewRows: rows (lastProcessedRow+1)..getLastRow()
  → leadMapper.mapRowToLead → leadClient.sendLeadToApi
  → update lastProcessedRow
  → toast feedback
```

## Common tasks

### Add a new column to the payload

1. Add field to `LeadPayload` in `src/types.ts`
2. Add mapping in `COLUMN_MAP` in `src/mapping/leadMapper.ts`
3. Update `docs/api-contract.md` and `docs/configuration.md`

### Change default values

Edit `DEFAULT_SOURCE`, `DEFAULT_STATUS`, `DEFAULT_SHEET_NAME` in `src/types.ts`

### Debug trigger not firing

- Confirm `enabled=true` in DocumentProperties
- Check trigger exists: Apps Script editor → Triggers (clock icon)
- Remember: onEdit does NOT fire for API writes
- Use `npm run logs:dev` for Stackdriver logs

### Add a new CardService button

1. Add handler function in `src/ui/homepage.ts`
2. Export it in `src/main.ts` → `exportedFunctions`
3. Add button in `buildActionsSection()`
4. Update `scripts/verify-build.mjs` required functions list

### Deploy to production

```bash
npm run verify
npm run deploy:prod
```

## External dependencies

| Dependency | Usage |
|------------|-------|
| Lead Control API | `POST {apiEndpoint}` with `x-api-key` header |
| Google Sheets API | Read sheet data (via SpreadsheetApp service) |
| Google Apps Script Services | SpreadsheetApp, PropertiesService, CacheService, UrlFetchApp, ScriptApp, CardService, MailApp |

## OAuth scopes (appsscript.json)

- `spreadsheets.currentonly` — read current spreadsheet
- `script.scriptapp` — manage installable triggers
- `script.external_request` — HTTP POST to Lead Control API
- `script.send_mail` — re-authorization alert emails

## Gotchas

- `onChange` event does NOT include which row changed → must use `lastProcessedRow` cursor
- `changeType` for API appends is usually `EDIT`, not `INSERT_ROW`
- Integrations filling multiple cells may fire onChange multiple times → debounce with CacheService (5s TTL)
- CardService form inputs arrive as `e.formInputs.fieldName[0]` (array)
- clasp 3.x does not transpile TypeScript — always run `npm run build` before push
- clasp 3.x uses `open-script` instead of the removed `open` command (wrapped by `npm run open:dev`)
- `.clasp.json` created by `clasp create` overwrites `dist/appsscript.json` — rebuild after create

## Build commands

```bash
npm run build      # esbuild → dist/Code.js
npm run verify     # build + check exports
npm run push:dev   # push to dev Apps Script project
npm run push:prod  # push to prod Apps Script project
npm run deploy:prod # push + clasp deploy
```

## Environment files (gitignored)

- `.clasp.dev.json` — dev scriptId
- `.clasp.prod.json` — prod scriptId
- Templates: `.clasp.dev.json.example`, `.clasp.prod.json.example`
