import { readFileSync, readdirSync, statSync, lstatSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { repositoryRoot } from '../lib/RepositoryRoot.mjs';

export const ROOT = repositoryRoot;

/** Directories that never participate in search, build, format, test or release. */
export const EXCLUDED = new Set([
  'node_modules',
  '.git',
  '.next',
  '.open-next',
  '.wrangler',
  'dist',
  'build',
  'storybook-static',
  'coverage',
  '.vercel',
  '.codex-temp',
  'tmp',
  'supabase/.temp',
]);

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);
export function isExcluded(path) {
  const normalized = relative(ROOT, path).split(/[\\/]/).join('/');
  if (normalized.startsWith('..')) return true;
  for (const part of normalized.split('/')) {
    if (EXCLUDED.has(part)) return true;
  }
  return EXCLUDED.has(normalized);
}

export function* walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(directory, entry);
    if (isExcluded(full)) continue;
    if (lstatSync(full).isSymbolicLink()) throw new Error(`WORKSPACE_LINK_FORBIDDEN:${rel(full)}`);
    let info;
    try {
      info = statSync(full);
    } catch {
      continue; // broken junction or dangling symlink
    }
    if (info.isDirectory()) {
      yield* walk(full);
    } else if (info.isFile()) {
      yield full;
    }
  }
}

export function sourceFiles(directory = ROOT) {
  const files = [];
  for (const file of walk(directory)) {
    if (SOURCE_EXTENSIONS.has(extname(file))) files.push(file);
  }
  return files;
}

export function read(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

export function rel(file) {
  return relative(ROOT, file).split(/[\\/]/).join('/');
}

/** Resolves a relative import specifier to a real file, mirroring bundler resolution. */
export function resolveRelativeImport(fromFile, specifier) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, `${base}.js`, `${base}.jsx`, `${base}.mjs`, `${base}.cjs`, join(base, 'index.ts'), join(base, 'index.tsx'), join(base, 'index.js'), join(base, 'index.mjs')];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"()]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_PATTERN = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_PATTERN = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;

export function imports(source) {
  const found = [];
  for (const pattern of [IMPORT_PATTERN, DYNAMIC_IMPORT_PATTERN, REQUIRE_PATTERN]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) found.push(match[1]);
  }
  return found;
}

/** Named and default exports declared by a module, used for call-site verification. */
export function exportedNames(source) {
  const names = new Set();
  const declaration = /export\s+(?:async\s+)?(?:function\s*\*?|class|const|let|var|type|interface|enum)\s+([A-Za-z0-9_$]+)/g;
  let match;
  while ((match = declaration.exec(source)) !== null) names.add(match[1]);
  const list = /export\s+(?:type\s+)?\{([^}]*)\}/g;
  while ((match = list.exec(source)) !== null) {
    for (const piece of match[1].split(',')) {
      const parts = piece.trim().split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0]).trim();
      if (name) names.add(name);
    }
  }
  if (/export\s+default\b/.test(source)) names.add('default');
  if (/export\s+(?:type\s+)?\*\s*(?:as\s+\w+\s+)?from/.test(source)) names.add('*');
  return names;
}

/** Named bindings a file pulls from one specifier. */
export function importedBindings(source, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`import\\s+([^'"]+?)\\s+from\\s+['"]${escaped}['"]`, 'g');
  const bindings = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    // `import type { A } from 'x'` carries no default binding; drop the modifier first.
    const clause = match[1].trim().replace(/^type\s+/, '');
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const piece of braces[1].split(',')) {
        const parts = piece
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/);
        const name = parts[0].trim();
        if (name) bindings.push(name);
      }
    }
    const defaultBinding = clause
      .replace(/\{[^}]*\}/, '')
      .replace(/,/g, '')
      .trim();
    if (defaultBinding && !defaultBinding.startsWith('*')) bindings.push('default');
  }
  return bindings;
}

export function workspaceGlobs() {
  const manifest = join(ROOT, 'package.json');
  if (!existsSync(manifest)) return [];
  try {
    return JSON.parse(readFileSync(manifest, 'utf8')).workspaces ?? [];
  } catch {
    return [];
  }
}

/** Every workspace package manifest that actually exists on disk. */
export function workspacePackages() {
  const packages = [];
  for (const glob of workspaceGlobs()) {
    const base = join(ROOT, glob.replace(/\/\*$/, ''));
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base)) {
      const manifest = join(base, entry, 'package.json');
      if (!existsSync(manifest)) continue;
      try {
        packages.push({ dir: join(base, entry), manifest, json: JSON.parse(readFileSync(manifest, 'utf8')) });
      } catch {
        /* reported by the manifest audit */
      }
    }
  }
  return packages;
}
