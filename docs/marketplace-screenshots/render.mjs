#!/usr/bin/env node
/**
 * Renders Marketplace screenshots (1280x800) from addon-ui.html via headless Chrome.
 *
 * Usage: node docs/marketplace-screenshots/render.mjs
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'out');
const htmlPath = join(__dirname, 'addon-ui.html');
const chrome =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
      (p) => existsSync(p),
  );

if (!chrome) {
  console.error('Chrome/Chromium not found. Set CHROME_PATH.');
  process.exit(1);
}

mkdirSync(outDir, {recursive: true});

const scenes = [
  {id: 'inactive', file: '01-painel-inativo.png', label: 'Painel inativo + planilha'},
  {id: 'mapping', file: '02-credenciais-e-mapeamento.png', label: 'Credenciais + mapeamento'},
  {id: 'active', file: '03-integracao-ativa.png', label: 'Integração ativa'},
  {id: 'toast', file: '04-teste-envio.png', label: 'Teste de envio com toast'},
  {id: 'newrow', file: '05-nova-linha-enviada.png', label: 'Nova linha processada'},
];

for (const scene of scenes) {
  const url = `${pathToFileURL(htmlPath).href}?scene=${scene.id}`;
  const out = join(outDir, scene.file);
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--window-size=1280,800`,
    `--screenshot=${out}`,
    '--default-background-color=00000000',
    url,
  ];
  console.log(`Rendering ${scene.file} (${scene.label})...`);
  const result = spawnSync(chrome, args, {encoding: 'utf8'});
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
  console.log(`  → ${out}`);
}

console.log('\nDone. Upload the PNGs from docs/marketplace-screenshots/out/ to the Marketplace listing.');
