#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createProgram, productionSources, relative, root, sourceFileMap, ts } from './source.mjs';

const moduleRoot = path.join(root, 'services/commerce/src/modules');
const scannedLayers = /\/(?:application\/(?:handler|service|process)|infrastructure\/persistence|interface\/job)\//;
const externalMethods = new Set(['callback', 'changes', 'decrypt', 'deliver', 'download', 'encrypt', 'exchange', 'fetch', 'health', 'prepay', 'publish', 'refund', 'request', 'send', 'start', 'upload', 'verifyNotification']);

export function auditTransactions(sources = productionSources()) {
  const selected = sources.filter((file) => file.startsWith(`${moduleRoot}${path.sep}`) && (scannedLayers.test(file.split(path.sep).join('/')) || /DurableOperationHandler/.test(ts.sys.readFile(file) ?? '')));
  const program = createProgram(sources);
  const checker = program.getTypeChecker();
  const sourceMap = sourceFileMap(program);
  const violations = [];

  for (const file of selected) {
    const source = sourceMap.get(path.resolve(file));
    if (!source) continue;
    const visit = (node) => {
      if (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) {
        const phase = enclosingPhase(node);
        if ((phase === 'execute' && handlerMethod(node)) || transactionParameter(node, checker) || phase === 'commit' || phase?.startsWith('commit') || inWriteCallback(node)) {
          const external = externalCall(node, checker, new Set());
          if (external) violations.push(`EXTERNAL_CALL_IN_TRANSACTION:${location(source, external)}:${external.expression.getText(source)}`);
        }
        if (phase === 'finalize') {
          const body = node.body?.getText(source) ?? '';
          if (/\b(?:TransactionContext|PgTransactionAccess|OperationDatabase|DatabasePool)\b|\.query\s*\(|this\.(?:repository|repo|database)\b/i.test(body)) {
            violations.push(`FINALIZE_PERSISTENCE_FORBIDDEN:${location(source, node)}:finalize`);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  for (const source of sourceMap.values()) {
    const file = source.fileName.split(path.sep).join('/');
    if (!file.startsWith(`${moduleRoot.split(path.sep).join('/')}/`) || !/\/infrastructure\/persistence\//.test(file)) continue;
    const visit = (node) => {
      if (ts.isMethodDeclaration(node) && readTransactionParameter(node, checker) && writeSql(node)) {
        violations.push(`READ_CONTEXT_WRITE_SQL:${location(source, node)}:${propertyName(node.name) ?? 'anonymous'}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...new Set(violations)].sort();
}

function handlerMethod(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isClassDeclaration(current)) return (current.heritageClauses ?? []).some((clause) => clause.types.some((type) => /(?:Durable)?OperationHandler/.test(type.expression.getText(current.getSourceFile()))));
  }
  return false;
}

function transactionParameter(node, checker) {
  return node.parameters.some((parameter) => /(?:Read|Write)?TransactionContext|(?:Write)?HandlerContext|CommitContext/.test(checker.typeToString(checker.getTypeAtLocation(parameter))));
}

function readTransactionParameter(node, checker) {
  return node.parameters.some((parameter) => {
    const type = checker.typeToString(checker.getTypeAtLocation(parameter));
    return /ReadTransactionContext/.test(type) && !/WriteTransactionContext/.test(type);
  });
}

function writeSql(node) {
  const body = node.body?.getText(node.getSourceFile()) ?? '';
  return /\b(?:insert\s+into|update\s+[a-z]|delete\s+from|for\s+(?:no\s+key\s+)?update|for\s+share)\b/i.test(body);
}

function externalCall(node, checker, seen) {
  let found;
  const visit = (current) => {
    if (found) return;
    if (ts.isCallExpression(current)) {
      const name = ts.isIdentifier(current.expression) ? current.expression.text : ts.isPropertyAccessExpression(current.expression) ? current.expression.name.text : '';
      const signature = checker.getResolvedSignature(current);
      const declaration = signature?.declaration;
      if (externalMethods.has(name) && !repositoryCall(current, checker) && externalDeclaration(declaration)) {
        found = current;
        return;
      }
      if (declaration && !seen.has(declaration) && followable(declaration)) {
        seen.add(declaration);
        const nested = externalCall(declaration, checker, seen);
        if (nested) found = current;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node.body ?? node);
  return found;
}

function followable(declaration) {
  const file = declaration.getSourceFile().fileName.split(path.sep).join('/');
  return file.startsWith(`${moduleRoot.split(path.sep).join('/')}/`) && /\/(?:application\/(?:handler|service|process)|domain)\//.test(file);
}

function externalDeclaration(declaration) {
  if (!declaration) return true;
  const file = declaration.getSourceFile().fileName.split(path.sep).join('/');
  return /\/platform\/(?:crypto\/KmsClient|secret\/ProviderSecret|object\/ObjectStore)\.ts$|\/application\/port\/(?:DirectoryProvider|FederatedIdentityProvider|PaymentGateway|PayoutGateway|RemoteRefundProvider)\.ts$|\/infrastructure\/(?:adapter|security)\//.test(
    file
  );
}

function repositoryCall(call, checker) {
  const signature = checker.getResolvedSignature(call);
  const declaration = signature?.declaration;
  if (!declaration) return false;
  const file = declaration.getSourceFile().fileName.split(path.sep).join('/');
  return /\/application\/port\/[^/]*Repository\.ts$|\/infrastructure\/persistence\//.test(file);
}

function enclosingPhase(node) {
  for (let current = node; current; current = current.parent) {
    if (ts.isMethodDeclaration(current) && current.name) return propertyName(current.name);
    if (ts.isPropertyAssignment(current)) return propertyName(current.name);
  }
  return undefined;
}

function inWriteCallback(node) {
  const parent = node.parent;
  return Boolean(parent && ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === 'write');
}

function propertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : undefined;
}

function location(source, node) {
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  return `${relative(source.fileName)}:${line}`;
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
