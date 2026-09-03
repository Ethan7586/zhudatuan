import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '../..');
const roots = ['apps', 'extensions', 'packages', 'scripts', 'services', 'tools'];
const ignored = new Set(['.next', '.open-next', 'build', 'coverage', 'dist', 'node_modules', 'storybook-static', 'tmp']);
const catalog = parse(await readFile(join(root, 'packages/contract/definitions/errors.yml'), 'utf8'));
if (catalog?.version !== 4 || !Array.isArray(catalog?.api) || !Array.isArray(catalog?.transport) || !Array.isArray(catalog?.client)) throw new Error('ERROR_CATALOG_INVALID');
const codes = new Map();
const namespaces = new Map([
  ['api', catalog.api],
  ['transport', catalog.transport],
  ['client', catalog.client],
]);
for (const [namespace, entries] of namespaces) for (const entry of entries) {
  if (entry === null || typeof entry !== 'object' || typeof entry.code !== 'string' || (namespace === 'api' && !Number.isSafeInteger(entry.status))) throw new Error('ERROR_CATALOG_INVALID');
  if (codes.has(entry.code)) throw new Error(`ERROR_CODE_DUPLICATE:${entry.code}`);
  if (!entry.owner || !entry.category || typeof entry.retryable !== 'boolean' || typeof entry.retryAfter !== 'boolean' || !entry.exposure || !entry.action || !entry.messageKey || !entry.message) {
    throw new Error(`ERROR_POLICY_INCOMPLETE:${namespace}:${entry.code}`);
  }
  codes.set(entry.code, { namespace, status: entry.status });
}

const occurrences = new Map();
const unsafeErrors = [];
const rawMessages = [];
const localBranches = [];
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
if (rawMessages.length > 0) throw new Error(`RAW_ERROR_MESSAGE_PRESENTED\n${rawMessages.sort().join('\n')}`);
if (localBranches.length > 0) throw new Error(`FRONTEND_ERROR_CODE_BRANCH\n${localBranches.sort().join('\n')}`);
process.stdout.write(`error-contract accepted=true declared=${codes.size} api=${catalog.api.length} transport=${catalog.transport.length} client=${catalog.client.length} literals=${occurrences.size} missing=0\n`);

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
    if (ts.isNewExpression(node) && node.expression.getText(source) === 'TransportError') recordNamespace(node.arguments?.[0], 'transport');
    if (ts.isNewExpression(node) && node.expression.getText(source) === 'ClientError') recordNamespace(node.arguments?.[0], 'client');
    if (ts.isNewExpression(node) && node.expression.getText(source) === 'Error') unsafe(node.arguments?.[0]);
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'reject') record(node.arguments[1]);
    if (frontend(path) && ts.isPropertyAccessExpression(node) && node.name.text === 'message' && rawErrorReference(node.expression) && insideJsx(node)) finding(rawMessages, node);
    if (frontend(path) && ts.isBinaryExpression(node) && equality(node.operatorToken.kind) && directErrorCode(node.left, node.right)) finding(localBranches, node);
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
  function recordNamespace(argument, namespace) {
    if (!argument || !ts.isStringLiteralLike(argument)) return;
    const entry = codes.get(argument.text);
    if (entry?.namespace !== namespace) unsafeErrors.push(`${relative(root, path)}:${argument.text}:EXPECTED_${namespace.toUpperCase()}`);
  }
  function unsafe(argument) {
    if (!path.startsWith(join(root, 'services/commerce/src')) || !argument || !ts.isStringLiteralLike(argument)) return;
    const definition = codes.get(argument.text);
    if (definition?.namespace !== 'api' || definition.status >= 500) return;
    const line = source.getLineAndCharacterOfPosition(argument.getStart(source)).line + 1;
    unsafeErrors.push(`${relative(root, path)}:${line}:${argument.text}`);
  }
  function finding(target, node) {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    target.push(`${relative(root, path)}:${line}:${node.getText(source)}`);
  }
}

function frontend(path) {
  return path.startsWith(join(root, 'apps')) || path.startsWith(join(root, 'packages/design'));
}

function equality(kind) {
  return kind === ts.SyntaxKind.EqualsEqualsEqualsToken || kind === ts.SyntaxKind.ExclamationEqualsEqualsToken;
}

function directErrorCode(left, right) {
  const code = ts.isStringLiteralLike(left) && /^[A-Z][A-Z0-9_]{2,}$/.test(left.text) ? right : ts.isStringLiteralLike(right) && /^[A-Z][A-Z0-9_]{2,}$/.test(right.text) ? left : undefined;
  return code !== undefined && ts.isPropertyAccessExpression(code) && code.name.text === 'code' && rawErrorReference(code.expression);
}

function rawErrorReference(node) {
  const text = node.getText().replaceAll(/[()?!]/g, '').trim();
  return /^(?:error|cause|exception)$/.test(text) || /^(?:error|cause|exception)\s+as\s+/.test(text);
}

function insideJsx(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxExpression(current)) return true;
    if (ts.isStatement(current) || ts.isSourceFile(current)) return false;
  }
  return false;
}
