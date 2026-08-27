import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const blockedSegments = ['/mock/', '/services/mallService', '/services/mallState', '/services/mallCatalogCart', '/services/mallOrders'];

function resolveSourceImport(importer: string, specifier: string) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(importer), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function productionImportGraph(entry: string) {
  const visited = new Set<string>();
  const pending = [entry];
  const patterns = [/\bfrom\s+['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, /\bimport\s+['"]([^'"]+)['"]/g];

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    patterns.forEach((pattern) => {
      pattern.lastIndex = 0;
      for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
        const dependency = resolveSourceImport(file, match[1]);
        if (dependency && !visited.has(dependency)) pending.push(dependency);
      }
    });
  }
  return [...visited];
}

describe('production storefront data boundary', () => {
  it.each([
    ['main App', resolve(sourceRoot, 'App.tsx')],
    ['production route', resolve(sourceRoot, '../app/page.tsx')],
  ])('cannot reach the local demo catalogue from the %s entry', (_label, entry) => {
    const graph = productionImportGraph(entry);
    const blocked = graph.filter((file) => blockedSegments.some((segment) => file.replaceAll('\\', '/').includes(segment)));

    expect(blocked).toEqual([]);
  });
});
