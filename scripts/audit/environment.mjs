import { readFileSync } from 'node:fs';

import { productionSources, relative } from '../check/source.mjs';
import { report } from './report.mjs';

const configRoot = 'packages/config/src/';
const config = productionSources()
  .filter((file) => relative(file).startsWith(configRoot))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');
const declared = new Set([...config.matchAll(/['"]([A-Z][A-Z0-9_]{2,})['"]/g)].map((match) => match[1]));
const violations = [];
const directRead = /(?:process\.env|import\.meta\.env)(?:\.([A-Z][A-Z0-9_]*)|\[['"]([A-Z][A-Z0-9_]*)['"]\])/g;

for (const file of productionSources()) {
  const name = relative(file);
  const source = readFileSync(file, 'utf8');
  for (const pattern of [directRead]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      const key = match[1] ?? match[2];
      if (!declared.has(key)) violations.push({ code: 'ENVIRONMENT_KEY_UNDECLARED', location: name, detail: key });
      if (!name.startsWith(configRoot)) violations.push({ code: 'ENVIRONMENT_READ_OUTSIDE_OWNER', location: name, detail: key });
    }
  }
  if (!name.startsWith(configRoot) && /(?:process\.env|import\.meta\.env)\s*\[/.test(source)) {
    violations.push({ code: 'ENVIRONMENT_DYNAMIC_READ', location: name, detail: 'dynamic environment lookup' });
  }
}

report('environment', violations);
