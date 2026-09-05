#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { productionSources, relative, root, ts } from './source.mjs';

const externalMethods = new Set([
  'decrypt', 'deliver', 'download', 'encrypt', 'evaluate', 'exchange', 'prepay', 'publish', 'refund', 'request', 'send', 'upload', 'verifyNotification',
]);
const moduleRoot = path.join(root, '01_core_hexin', 'services', 'commerce', 'src', 'modules');

function propertyName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return node.text;
  return undefined;
}

function containsExternalCall(node) {
  let found = false;
  const visit = (current) => {
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)
      && externalMethods.has(current.expression.name.text)) found = true;
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function lifecyclePhase(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isPropertyAssignment(current)) {
      const name = propertyName(current.name);
      if (name === 'prepare' || name === 'execute' || name === 'finalize') return name;
    }
    if (ts.isNewExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === 'ModuleOperations') return 'execute';
  }
  return undefined;
}

export function auditTransactions() {
  const violations = [];
  for (const file of productionSources().filter((source) => source.startsWith(`${moduleRoot}${path.sep}`) && source.endsWith('Operations.ts'))) {
    const source = ts.createSourceFile(file, ts.sys.readFile(file) ?? '', ts.ScriptTarget.Latest, true);
    const externalHelpers = new Set();
    for (const statement of source.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name && containsExternalCall(statement)) externalHelpers.add(statement.name.text);
    }
    const visit = (node) => {
      if (ts.isCallExpression(node) && lifecyclePhase(node) === 'execute') {
        const direct = ts.isPropertyAccessExpression(node.expression) && externalMethods.has(node.expression.name.text);
        const transitive = ts.isIdentifier(node.expression) && externalHelpers.has(node.expression.text);
        if (direct || transitive) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          violations.push(`${relative(file)}:${line}:${direct ? node.expression.name.text : node.expression.text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return violations.sort();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const violations = auditTransactions();
  if (violations.length) {
    console.error(['Transaction boundary audit failed:', ...violations.map((value) => `- ${value}`)].join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Transaction boundary audit passed.');
  }
}
