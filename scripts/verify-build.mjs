/**
 * Verifies the build output exposes all functions required by appsscript.json.
 */
import {readFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = readFileSync(join(root, 'dist/Code.js'), 'utf8');
const manifest = JSON.parse(
    readFileSync(join(root, 'dist/appsscript.json'), 'utf8'),
);

const requiredFunctions = [
  manifest.addOns?.sheets?.homepageTrigger?.runFunction,
  'onChangeHandler',
  'onInstall',
  'handleSaveConfiguration',
  'handleDisableIntegration',
  'handleTestLastRow',
  'handleReprocessLastRow',
].filter(Boolean);

const missing = requiredFunctions.filter(
    (fn) => !code.includes(`function ${fn}`) && !code.includes(`${fn},`),
);

if (missing.length > 0) {
  console.error('Missing exported functions:', missing.join(', '));
  process.exit(1);
}

console.log('Build verification passed.');
console.log(`Exported functions: ${requiredFunctions.join(', ')}`);
