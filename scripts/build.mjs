import {build} from 'esbuild';
import {copyFileSync, mkdirSync} from 'fs';
import {dirname, join} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const distDir = join(root, 'dist');

mkdirSync(distDir, {recursive: true});

await build({
  entryPoints: [join(root, 'src/main.ts')],
  bundle: true,
  outfile: join(distDir, 'Code.js'),
  format: 'iife',
  target: 'es2019',
  platform: 'neutral',
  logLevel: 'info',
});

copyFileSync(join(root, 'src/appsscript.json'), join(distDir, 'appsscript.json'));

console.log('Build complete: dist/Code.js + dist/appsscript.json');
