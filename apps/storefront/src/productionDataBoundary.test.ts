import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sourceRoot = dirname(fileURLToPath(import.meta.url));
const blockedSegments = ['/mock/', '/services/mallService', '/services/mallState', '/services/mallCatalogCart', '/services/mallOrders', '/screens/', '/components/home/', '/components/security/', '/features/architecture/'];
const retiredSourcePath = /(?:^|\/)(?:mock|showcase|demo|desktop|laptop|tablet|mobile|miniprogram|android)(?:\/|[A-Z.])/i;
const retiredSourceMarker = /PendingInterfaceModal|接口待接入|高保真交互预览|navigationBoundary\s*=\s*['"]showcase['"]/;
const features = ['account', 'aftersale', 'benefit', 'cart', 'catalog', 'checkout', 'home', 'notification', 'order', 'payment', 'product', 'referral', 'security', 'support', 'voucher'];

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
    ['canonical storefront root', resolve(sourceRoot, 'app/App.tsx')],
    ['production entry', resolve(sourceRoot, 'main.tsx')],
  ])('cannot reach retired or local-demo UI from the %s entry', (_label, entry) => {
    const graph = productionImportGraph(entry);
    const blocked = graph.filter((file) => blockedSegments.some((segment) => file.replaceAll('\\', '/').includes(segment)));

    expect(blocked).toEqual([]);
  });

  it('routes production through the approved storefront component family', () => {
    const graph = productionImportGraph(resolve(sourceRoot, 'main.tsx')).map((file) => file.replaceAll('\\', '/'));

    expect(graph.some((file) => file.endsWith('/src/app/App.tsx'))).toBe(true);
    expect(graph.some((file) => file.endsWith('/src/shell/StorefrontShell.tsx'))).toBe(true);
    expect(graph.some((file) => /\/src\/shell\/(?:Desktop|Tablet|Mobile)Shell\.tsx$/.test(file))).toBe(false);
    expect(graph.some((file) => file.endsWith('/src/App.tsx'))).toBe(false);
  });

  it('keeps every canonical feature tested without device-specific business forks', () => {
    const featureRoot = resolve(sourceRoot, 'feature');
    expect(readdirSync(featureRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map(({ name }) => name).sort()).toEqual(features);
    for (const feature of features) {
      const files = sourceFiles(resolve(featureRoot, feature));
      expect(files.some((file) => /\.test\.tsx?$/.test(file)), `${feature} must retain an executable test`).toBe(true);
      expect(files.filter((file) => /(?:^|\/)(?:desktop|laptop|tablet|mobile|android|miniprogram)(?:\/|[A-Z.])/i.test(file))).toEqual([]);
    }
  });

  it('contains no retired preview, placeholder, mock, or device-fork production source', () => {
    const productionFiles = sourceFiles(sourceRoot).filter((file) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));

    expect(productionFiles.filter((file) => retiredSourcePath.test(file.replaceAll('\\', '/')))).toEqual([]);
    expect(productionFiles.filter((file) => retiredSourceMarker.test(readFileSync(file, 'utf8')))).toEqual([]);
  });
});

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sourceFiles(resolve(root, entry.name)) : [resolve(root, entry.name)]);
}
