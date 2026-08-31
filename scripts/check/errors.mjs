import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const roots = ['apps', 'extensions', 'packages', 'scripts', 'services', 'tools'];
const ignored = new Set(['.next', '.open-next', 'build', 'coverage', 'dist', 'node_modules', 'storybook-static', 'tmp']);
const catalog = parse(await readFile(join(root, 'packages/contract/definitions/errors.yml'), 'utf8'));
if (!Array.isArray(catalog?.errors)) throw new Error('ERROR_CATALOG_INVALID');
const codes = new Map();
for (const entry of catalog.errors) {
  if (entry === null || typeof entry !== 'object' || typeof entry.code !== 'string' || !Number.isSafeInteger(entry.status)) throw new Error('ERROR_CATALOG_INVALID');
  if (codes.has(entry.code)) throw new Error(`ERROR_CODE_DUPLICATE:${entry.code}`);
  codes.set(entry.code, entry.status);
}

const occurrences = new Map();
const unsafeErrors = [];
for (const directory of roots) await scan(join(root, directory));
const missing = [...occurrences].filter(([code]) => !codes.has(code));
if (missing.length > 0) {
  const report = missing
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([code, locations]) => `${code} ${[...locations].sort().join(',')}`)
    .join('\n');
  throw new Error(`ERROR_CONTRACT_MISSING\n${report}`);
}
if (unsafeErrors.length > 0) throw new Error(`BUSINESS_ERROR_MAPPED_TO_INTERNAL\n${unsafeErrors.sort().join('\n')}`);
process.stdout.write(`error-contract accepted=true declared=${codes.size} literals=${occurrences.size} missing=0\n`);

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) && ['.js', '.mjs', '.ts', '.tsx'].includes(extname(entry.name))) inspect(path, await readFile(path, 'utf8'));
  }
}

function inspect(path, sourceText) {
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);
  const visit = (node) => {
    if (ts.isNewExpression(node) && ['ApplicationError', 'DomainError'].includes(node.expression.getText(source))) record(node.arguments?.[0]);
    if (ts.isNewExpression(node) && node.expression.getText(source) === 'Error') unsafe(node.arguments?.[0]);
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'reject') record(node.arguments[1]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  function record(argument) {
    if (!argument || !ts.isStringLiteralLike(argument) || !/^[A-Z][A-Z0-9_]{2,}$/.test(argument.text)) return;
    const line = source.getLineAndCharacterOfPosition(argument.getStart(source)).line + 1;
    const location = `${relative(root, path)}:${line}`;
    const values = occurrences.get(argument.text) ?? new Set();
    values.add(location);
    occurrences.set(argument.text, values);
  }
  function unsafe(argument) {
    if (!path.startsWith(join(root, 'services/commerce/src')) || !argument || !ts.isStringLiteralLike(argument) || !codes.has(argument.text) || codes.get(argument.text) >= 500) return;
    const line = source.getLineAndCharacterOfPosition(argument.getStart(source)).line + 1;
    unsafeErrors.push(`${relative(root, path)}:${line}:${argument.text}`);
  }
}
