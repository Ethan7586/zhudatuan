/**
 * Naming convention audit.
 *
 * Rule: own files and directories must not contain underscores, hyphens, spaces or
 * meaningless abbreviations. Exempt: cli output, the audit tooling itself, tool-mandated
 * configuration files, database migration SQL and test fixtures.
 */
import { basename, extname } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { walk, rel, ROOT } from './workspace.mjs';

const policy = parse(readFileSync(`${ROOT}/config/naming.yml`, 'utf8'));
const DIRECTORY_NAME = new RegExp(policy.production.directory);
const FILE_NAME = new RegExp(policy.production.file);
const FORBIDDEN_SUFFIXES = Object.freeze([...(policy.forbidden?.productionFileSuffixes ?? [])]);
const POLICY_EXCEPTIONS = new Set(policy.exceptions ?? []);

/** Tool-mandated names that cannot be renamed without breaking their ecosystem. */
const EXEMPT_FILES = new Set([
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'tsconfig.app.json',
  'vite.config.ts',
  'vitest.config.ts',
  'next.config.ts',
  'next-env.d.ts',
  'postcss.config.js',
  'tailwind.config.ts',
  'eslint.config.js',
  '.eslintrc.json',
  '.prettierrc.json',
  '.prettierignore',
  '.editorconfig',
  '.gitignore',
  '.gitattributes',
  '.npmrc',
  '.nvmrc',
  'README.md',
  'LICENSE',
  'Caddyfile',
  'Dockerfile',
  'docker-compose.yml',
  'project.config.json',
  'project.private.config.json',
  'sitemap.config.json',
  'components.json',
  'manifest.json',
  'app.json',
  'THIRD_PARTY_NOTICES.md',
  'catalog-oss.mjs',
  'mobile-platforms.json',
]);

/** Directories whose contents are exempt by the project's own naming rule. */
const EXEMPT_PREFIXES = [
  'scripts/', // scripts and audit code are explicitly exempt
  'config/', // operator-owned configuration follows YAML/vendor naming conventions
  'database/', // SQL migrations keep timestamp_snake naming
  'docs/', // requirement and decision documents
  'infrastructure/', // vendor-mandated deployment file names
  '.github/',
  '.vercel/',
  'node_modules/',
  'packages/design/storybook-static/', // generated Storybook delivery artifact
  '.pnpm-store/', // package-manager cache is not product source
];

const EXEMPT_EXTENSIONS = new Set(['.sql', '.json', '.yml', '.yaml', '.toml', '.md', '.lock', '.svg', '.png', '.jpg', '.webp', '.ico', '.xlsx', '.docx', '.pdf', '.zip', '.csv', '.cmd', '.py']);

function isExempt(path) {
  if (EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  const name = basename(path);
  const segments = path.split('/');
  if (POLICY_EXCEPTIONS.has('cli') && segments.some((segment) => segment.startsWith('.'))) return true;
  if (POLICY_EXCEPTIONS.has('config') && (name.includes('.config.') || name.endsWith('.config.ts') || name.endsWith('.config.mjs'))) return true;
  if (POLICY_EXCEPTIONS.has('test') && /\.(?:test|spec|stories)\.[^.]+$/.test(name)) return true;
  if (EXEMPT_FILES.has(name)) return true;
  if (name.startsWith('.')) return true;
  if (EXEMPT_EXTENSIONS.has(extname(name))) return true;
  if (/\.(?:test|spec)\.[^.]+$/.test(name)) return true;
  return false;
}

export function auditNaming() {
  const findings = [];
  const reportedDirectories = new Set();

  for (const file of walk(ROOT)) {
    const path = rel(file);
    if (isExempt(path)) continue;

    const segments = path.split('/');
    const fileName = segments.pop();

    for (let index = 0; index < segments.length; index += 1) {
      const directory = segments.slice(0, index + 1).join('/');
      if (reportedDirectories.has(directory)) continue;
      if (EXEMPT_PREFIXES.some((prefix) => `${directory}/`.startsWith(prefix))) continue;
      if (!DIRECTORY_NAME.test(segments[index])) {
        reportedDirectories.add(directory);
        findings.push({ kind: 'directory', file: directory, detail: `connector in directory name "${segments[index]}"` });
      }
    }

    if (!FILE_NAME.test(fileName) || FORBIDDEN_SUFFIXES.some((suffix) => fileName.endsWith(suffix))) {
      findings.push({ kind: 'file', file: path, detail: `connector in file name "${fileName}"` });
    }
  }

  return findings;
}

if (process.argv[1]?.endsWith('naming.mjs')) {
  const findings = auditNaming();
  const directories = findings.filter((finding) => finding.kind === 'directory');
  const files = findings.filter((finding) => finding.kind === 'file');
  console.log(`\n[directory] ${directories.length}`);
  for (const finding of directories) console.log(`  ${finding.file}`);
  console.log(`\n[file] ${files.length}`);
  for (const finding of files.slice(0, 40)) console.log(`  ${finding.file}`);
  if (files.length > 40) console.log(`  ... ${files.length - 40} more`);
  console.log(`\nnaming findings: ${findings.length}`);
  process.exit(findings.length > 0 ? 1 : 0);
}
