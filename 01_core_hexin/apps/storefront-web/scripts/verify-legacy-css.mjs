import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const assetDirectory = new URL('../dist/client/assets/', import.meta.url);
const cssFiles = (await readdir(assetDirectory)).filter((name) => name.endsWith('.css'));

if (cssFiles.length === 0) {
  throw new Error('legacy_css_gate_missing_bundle');
}

for (const fileName of cssFiles) {
  const css = await readFile(join(assetDirectory.pathname, fileName), 'utf8');

  if (/@layer(?:\s|[,{])/.test(css)) {
    throw new Error(`legacy_css_gate_cascade_layer:${fileName}`);
  }

  if (!css.includes('.flex{display:flex}')) {
    throw new Error(`legacy_css_gate_missing_layout_utilities:${fileName}`);
  }

  if (!css.includes('--color-blue-600:#')) {
    throw new Error(`legacy_css_gate_missing_color_fallback:${fileName}`);
  }
}

console.log(`Legacy WebView CSS verified: ${cssFiles.length} bundle(s)`);
