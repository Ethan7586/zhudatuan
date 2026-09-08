#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';

import { createProgram, forbiddenProductionParts, productionSources, relative, root, sourceFileMap, ts } from './source.mjs';

const sources = productionSources();
const program = createProgram(sources);
const sourceFiles = sourceFileMap(program);
const findings = new Set();
const marker = /\b(?:TODO|FIXME|HACK)\b|\bcoming soon\b|敬请期待|功能将在后续|待接入|暂未开放|部分开放/gi;
const forbiddenImportPart = /(?:^|\/)(?:mock|mocks|demo|sample|fake|stub)(?:\/|$)|previewData/i;
const legacyComponents = new Set(['LocalImportDialog.tsx', 'ProductBatchPreview.tsx', 'OrderPreviewAction.tsx']);

for (const file of sources) auditSource(file);
for (const file of clientAssets()) auditText(file, false);
for (const file of clientBundles()) auditText(file, true);

if (findings.size > 0) {
  console.error(`production placeholders rejected: ${findings.size}`);
  for (const finding of [...findings].sort()) console.error(finding);
  process.exit(1);
}

console.log(`production placeholders accepted: sources=${sources.length} assets=${clientAssets().length} bundles=${clientBundles().length}`);

function auditSource(file) {
  const name = relative(file);
  const parts = name.toLowerCase().split('/');
  if (parts.some((part) => forbiddenProductionParts.has(part))) add('PLACEHOLDER_PATH', name);
  if (legacyComponents.has(path.basename(file))) add('LEGACY_PLACEHOLDER_COMPONENT', name);
  auditText(file, false);
  const source = sourceFiles.get(fs.realpathSync.native(file));
  if (!source) return;
  visit(source, source);
}

function visit(node, source) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const value = node.moduleSpecifier;
    if (value && ts.isStringLiteralLike(value) && forbiddenImportPart.test(value.text)) add('PRODUCTION_PLACEHOLDER_IMPORT', location(source, value), value.text);
  }
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const value = node.arguments[0];
    if (value && ts.isStringLiteralLike(value) && forbiddenImportPart.test(value.text)) add('PRODUCTION_PLACEHOLDER_IMPORT', location(source, value), value.text);
  }
  if (ts.isCatchClause(node) && node.block.statements.length === 0 && !documentedEmptyBlock(node.block, source)) add('SWALLOWED_CATCH', location(source, node));
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const owner = node.expression.expression.getText(source);
    const method = node.expression.name.text;
    if (owner === 'console' && method === 'log' && nameIsClient(source.fileName)) add('CLIENT_CONSOLE_LOG', location(source, node));
    if (owner === 'Math' && method === 'random' && nameIsClient(source.fileName)) add('RANDOM_CLIENT_BUSINESS_VALUE', location(source, node));
    if (method === 'catch' && node.arguments.some(emptyCallback)) add('SWALLOWED_PROMISE_CATCH', location(source, node));
  }
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) auditControl(node, source);
  ts.forEachChild(node, (child) => visit(child, source));
}

function auditControl(node, source) {
  const tag = node.tagName.getText(source);
  const attributes = node.attributes.properties;
  const attribute = (name) => attributes.find((item) => ts.isJsxAttribute(item) && item.name.getText(source) === name);
  const spread = attributes.some(ts.isJsxSpreadAttribute);
  if (!['a', 'Link', 'button', 'Button'].includes(tag)) return;
  const disabled = attribute('disabled');
  if (disabled && literalTrue(disabled)) add('PERMANENT_DISABLED_ACTION', location(source, disabled), tag);
  if ((tag === 'a' || tag === 'Link') && emptyAttribute(attribute(tag === 'a' ? 'href' : 'to'))) add('EMPTY_ACTION_LINK', location(source, node), tag);
  if (tag !== 'button' && tag !== 'Button') return;
  const type = stringAttribute(attribute('type'));
  const handler = attribute('onClick') ?? attribute('onPress');
  if (handler && emptyHandler(handler)) add('EMPTY_ACTION_HANDLER', location(source, handler), tag);
  if (!handler && !spread && type !== 'submit' && type !== 'reset' && !(tag === 'button' && type === undefined && withinForm(node))) add('INERT_ACTION_BUTTON', location(source, node), tag);
}

function literalTrue(attribute) {
  if (!attribute.initializer) return true;
  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) return false;
  return attribute.initializer.expression.kind === ts.SyntaxKind.TrueKeyword;
}

function emptyAttribute(attribute) {
  if (!attribute || !attribute.initializer) return true;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text.trim() === '' || attribute.initializer.text.trim() === '#';
  if (!ts.isJsxExpression(attribute.initializer) || !attribute.initializer.expression) return true;
  return ts.isStringLiteralLike(attribute.initializer.expression) && ['', '#'].includes(attribute.initializer.expression.text.trim());
}

function stringAttribute(attribute) {
  if (!attribute?.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  const value = ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
  return value && ts.isStringLiteralLike(value) ? value.text : undefined;
}

function emptyHandler(attribute) {
  const value = attribute.initializer && ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
  return Boolean(value && emptyCallback(value));
}

function emptyCallback(value) {
  return (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) && ts.isBlock(value.body) && value.body.statements.length === 0 && !documentedEmptyBlock(value.body, value.getSourceFile());
}

function documentedEmptyBlock(block, source) {
  return block.getFullText(source).replace(/[{}\s]/g, '').length >= 8;
}

function withinForm(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current) && current.openingElement.tagName.getText(current.getSourceFile()) === 'form') return true;
    current = current.parent;
  }
  return false;
}

function auditText(file, bundle) {
  const content = fs.readFileSync(file, 'utf8');
  marker.lastIndex = 0;
  for (const match of content.matchAll(marker)) {
    const line = bundle ? undefined : content.slice(0, match.index).split('\n').length;
    add(bundle ? 'BUNDLE_PLACEHOLDER_COPY' : 'PLACEHOLDER_MARKER', line ? `${relative(file)}:${line}` : relative(file), match[0]);
  }
  if (!bundle && /href\s*=\s*['"](?:#|)['"]/.test(content)) add('EMPTY_ACTION_LINK', relative(file));
}

function clientAssets() {
  const clients = parse(fs.readFileSync(path.join(root, 'config/clients.yml'), 'utf8')).clients ?? [];
  return clients.flatMap((client) => walk(path.join(root, client.path, client.sourceRoot), new Set(['.css', '.html', '.json', '.scss', '.wxml', '.wxss']))).sort();
}

function clientBundles() {
  const clients = parse(fs.readFileSync(path.join(root, 'config/clients.yml'), 'utf8')).clients ?? [];
  return clients.flatMap((client) => walk(path.join(root, client.path, 'dist'), new Set(['.html', '.js', '.wxml']))).sort();
}

function walk(directory, extensions) {
  if (!fs.existsSync(directory)) return [];
  const values = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...walk(target, extensions));
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) values.push(target);
  }
  return values;
}

function nameIsClient(file) {
  const name = relative(file);
  return /^apps\/(?:auth|console|storefront|miniapp|store|supplier)\/(?:src|miniapp)\//.test(name);
}

function location(source, node) {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `${relative(source.fileName)}:${position.line + 1}`;
}

function add(code, place, detail = '') {
  findings.add(`${code} ${place}${detail ? ` ${detail}` : ''}`);
}
