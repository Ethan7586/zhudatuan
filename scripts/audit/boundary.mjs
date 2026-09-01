#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';

import { auditOwnership } from '../check/ownership.mjs';
import { createProgram, moduleReferences, productionSources, relative, root, sourceFileMap, ts } from '../check/source.mjs';

const moduleRoot = path.join(root, 'services/commerce/src/modules');
const operationContract = parse(fs.readFileSync(path.join(root, 'packages/contract/definitions/operations.yml'), 'utf8'), { merge: true });
const namingPolicy = parse(fs.readFileSync(path.join(root, 'config/naming.yml'), 'utf8'));
const allowedRootFiles = new Set(['Module.ts', 'Manifest.ts']);
const allowedLayers = new Set(['application', 'domain', 'infrastructure', 'interface', 'public', 'test']);
const allowedLeaves = Object.freeze({
  application: new Set(['handler', 'port', 'service', 'process', 'model']),
  domain: new Set(['model', 'value', 'policy', 'service', 'event', 'error']),
  infrastructure: new Set(['persistence', 'adapter', 'integration', 'cache', 'messaging', 'registry', 'security']),
  interface: new Set(['http', 'job', 'event', 'webhook']),
});
const layerRule = Object.freeze({ domain: new Set(['application', 'infrastructure', 'interface']), application: new Set(['infrastructure', 'interface']), infrastructure: new Set(['interface']), interface: new Set() });
const publicDatabase = /\b(?:OperationDatabase|DatabasePool|QueryResult(?:Row)?|PoolClient|SqlExecutor|PgTransactionAccess)\b|from\s+['"]pg['"]|\.query\s*\(/;
const publicResultRow = /\b(?:QueryResult(?:Row)?|rowCount|\.rows\b|[a-zA-Z]+_id\b)/;
const sql = /\b(?:select\s+.+\s+from|insert\s+into|update\s+[a-z]|delete\s+from|merge\s+into|truncate\s+)/is;
const externalMethods = new Set(['decrypt', 'deliver', 'download', 'encrypt', 'exchange', 'fetch', 'prepay', 'refund', 'request', 'send', 'upload', 'verifyNotification']);

export const architectureDiagnostics = Object.freeze([
  'MODULE_ROOT_FILE_FORBIDDEN',
  'MODULE_ROOT_TEST_FORBIDDEN',
  'MODULE_ASSEMBLY_MISSING',
  'MODULE_LAYER_UNKNOWN',
  'MODULE_COMPOSITION_LOGIC_FORBIDDEN',
  'MANIFEST_SIDE_EFFECT_FORBIDDEN',
  'OPERATIONS_AGGREGATOR_FORBIDDEN',
  'HANDLER_PATH_INVALID',
  'HANDLER_CARDINALITY_INVALID',
  'HANDLER_OPERATION_MISMATCH',
  'HANDLER_STUB_FORBIDDEN',
  'HANDLER_SQL_FORBIDDEN',
  'PUBLIC_DATABASE_TYPE_FORBIDDEN',
  'PUBLIC_IMPLEMENTATION_FORBIDDEN',
  'PUBLIC_RESULT_ROW_FORBIDDEN',
  'REPOSITORY_PATH_INVALID',
  'REPOSITORY_OWNER_INVALID',
  'CROSS_SCHEMA_SQL_FORBIDDEN',
  'CROSS_MODULE_INTERNAL_IMPORT',
  'MODULE_DEPENDENCY_UNDECLARED',
  'TRANSACTION_CONTEXT_ESCAPE',
  'RAW_TRANSACTION_IMPORT_FORBIDDEN',
  'EXTERNAL_CALL_IN_TRANSACTION',
  'UNRESOLVED_IMPORT',
  'MODULE_SYMLINK_ESCAPE',
  'PRODUCTION_NAME_INVALID',
]);

export function auditBoundaries(options = {}) {
  const sources = options.sources ?? productionSources();
  const operations = options.operations ?? operationContract.operations ?? [];
  const program = createProgram(sources);
  const sourceMap = sourceFileMap(program);
  const findings = [];
  const add = (code, file, detail) => findings.push({ code, file, detail });
  const operationByPath = new Map(operations.map((operation) => [operation.handler, operation]));
  const operationOwners = new Set(operations.map((operation) => operation.owner));
  const assemblyInstantiations = handlerInstantiations(sources, sourceMap);

  for (const owner of operationOwners) {
    const directory = path.join(moduleRoot, owner);
    for (const file of allowedRootFiles) if (!fs.existsSync(path.join(directory, file))) add('MODULE_ASSEMBLY_MISSING', `services/commerce/src/modules/${owner}/${file}`, owner);
    if (fs.existsSync(directory)) {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (entry.isFile() && isTestFile(entry.name)) add('MODULE_ROOT_TEST_FORBIDDEN', relative(path.join(directory, entry.name)), 'test belongs in module test directory');
      }
    }
  }
  for (const entry of fs.readdirSync(moduleRoot, { withFileTypes: true })) {
    if (entry.isFile() && isTestFile(entry.name)) add('MODULE_ROOT_TEST_FORBIDDEN', relative(path.join(moduleRoot, entry.name)), 'global architecture test belongs in services/commerce/test/architecture');
  }
  for (const operation of operations) {
    if (operation.handler !== `services/commerce/src/modules/${operation.owner}/application/handler/${path.basename(operation.handler)}`) {
      add('HANDLER_PATH_INVALID', operation.handler, `${operation.id}:${operation.owner}`);
    }
  }

  for (const file of sources) {
    const rel = relative(file);
    const sourceFile = sourceMap.get(fs.realpathSync.native(file));
    if (!sourceFile) continue;
    const source = sourceFile.text;
    if (file.endsWith('Operations.ts')) add('OPERATIONS_AGGREGATOR_FORBIDDEN', rel, 'production Operations aggregator');
    auditName(rel, add);

    if (!file.startsWith(`${moduleRoot}${path.sep}`)) continue;
    const moduleRelative = path.relative(moduleRoot, file);
    const parts = moduleRelative.split(path.sep);
    const owner = parts[0];
    const moduleDirectory = path.join(moduleRoot, owner);
    if (!fs.realpathSync.native(file).startsWith(`${fs.realpathSync.native(moduleDirectory)}${path.sep}`)) add('MODULE_SYMLINK_ESCAPE', rel, owner);
    auditLayout(parts, rel, sourceFile, add);
    auditImports(owner, parts[1], rel, sourceFile, add);
    if (parts[1] === 'Module.ts') auditModuleDependencies(owner, rel, sourceFile, sourceMap, add);
    auditHandler(rel, sourceFile, source, operationByPath.get(rel), assemblyInstantiations, add);
    auditPublic(parts, rel, sourceFile, source, add);
    auditRepositories(owner, parts, rel, sourceFile, add);
    auditTransactionSafety(parts, rel, sourceFile, source, add);
  }

  for (const violation of auditOwnership(sources, options.objects)) add('CROSS_SCHEMA_SQL_FORBIDDEN', violation.file, `${violation.module}->${violation.schema}`);
  return findings.sort((left, right) => `${left.code}:${left.file}:${left.detail}`.localeCompare(`${right.code}:${right.file}:${right.detail}`));
}

function auditModuleDependencies(owner, rel, sourceFile, sourceMap, add) {
  const manifestPath = path.join(moduleRoot, owner, 'Manifest.ts');
  if (!fs.existsSync(manifestPath)) return;
  const manifest = sourceMap.get(fs.realpathSync.native(manifestPath));
  if (!manifest) return;
  const declared = manifestDependencies(manifest);
  for (const reference of moduleReferences(sourceFile)) {
    if (!reference.target || reference.node.importClause?.isTypeOnly === true) continue;
    const target = relative(reference.target);
    const match = target.match(/^services\/commerce\/src\/modules\/([^/]+)\/public\//);
    if (!match || match[1] === owner || declared.has(match[1])) continue;
    add('MODULE_DEPENDENCY_UNDECLARED', `${rel}:${reference.line}`, `${owner}->${match[1]}`);
  }
}

function manifestDependencies(sourceFile) {
  const dependencies = new Set();
  const call = firstNode(sourceFile, (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'defineModuleManifest');
  if (!call || !ts.isCallExpression(call)) return dependencies;
  addStringArray(call.arguments[1], dependencies);
  const workloads = call.arguments[3];
  if (workloads && ts.isObjectLiteralExpression(workloads)) {
    const visit = (node) => {
      if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'dependencies') addStringArray(node.initializer, dependencies);
      ts.forEachChild(node, visit);
    };
    visit(workloads);
  }
  return dependencies;
}

function addStringArray(node, values) {
  if (!node || !ts.isArrayLiteralExpression(node)) return;
  for (const element of node.elements) if (ts.isStringLiteralLike(element)) values.add(element.text);
}

function auditLayout(parts, rel, sourceFile, add) {
  if (parts.length === 2) {
    if (isTestFile(parts[1])) add('MODULE_ROOT_TEST_FORBIDDEN', rel, 'test belongs in module test directory');
    else if (!allowedRootFiles.has(parts[1])) add('MODULE_ROOT_FILE_FORBIDDEN', rel, 'module root only allows Module.ts and Manifest.ts');
  } else {
    const layer = parts[1];
    if (!allowedLayers.has(layer)) add('MODULE_LAYER_UNKNOWN', rel, layer);
    const leaves = allowedLeaves[layer];
    if (leaves && (parts.length < 4 || !leaves.has(parts[2]))) add('MODULE_LAYER_UNKNOWN', rel, `${layer}/${parts[2] ?? '<file>'}`);
  }
  if (parts[1] === 'Module.ts') {
    if (containsNode(sourceFile, (node) => ts.isIfStatement(node) || ts.isSwitchStatement(node) || ts.isConditionalExpression(node)) || sql.test(sourceFile.text)) {
      add('MODULE_COMPOSITION_LOGIC_FORBIDDEN', rel, 'assembly contains decision or SQL');
    }
  }
  if (parts[1] === 'Manifest.ts') {
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement)) continue;
      if (ts.isVariableStatement(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue;
      add('MANIFEST_SIDE_EFFECT_FORBIDDEN', rel, 'manifest must contain imports and one exported static declaration');
    }
    if (containsCallOtherThan(sourceFile, new Set(['defineModuleManifest', 'freeze']))) add('MANIFEST_SIDE_EFFECT_FORBIDDEN', rel, 'manifest executes non-declarative code');
  }
}

function auditImports(owner, layer, rel, sourceFile, add) {
  for (const reference of moduleReferences(sourceFile)) {
    if (!reference.external && !reference.target) add('UNRESOLVED_IMPORT', `${rel}:${reference.line}`, reference.specifier);
    if (!reference.target) continue;
    const target = relative(reference.target);
    const targetMatch = target.match(/^services\/commerce\/src\/modules\/([^/]+)\/(.+)$/);
    if (!targetMatch) continue;
    const [, targetOwner, targetPath] = targetMatch;
    if (targetOwner !== owner) {
      if (!targetPath.startsWith('public/')) add('CROSS_MODULE_INTERNAL_IMPORT', `${rel}:${reference.line}`, `${owner}->${targetOwner}/${targetPath}`);
      if (/Repository/.test(targetPath)) add('REPOSITORY_OWNER_INVALID', `${rel}:${reference.line}`, `${owner}->${targetOwner}`);
      continue;
    }
    const targetLayer = targetPath.split('/')[0];
    if (layerRule[layer]?.has(targetLayer)) add('CROSS_MODULE_INTERNAL_IMPORT', `${rel}:${reference.line}`, `${layer}->${targetLayer}`);
  }
}

function auditHandler(rel, sourceFile, source, operation, assemblyInstantiations, add) {
  const looksLikeHandler = rel.includes('/application/handler/') || operation !== undefined;
  if (!looksLikeHandler) return;
  if (!operation) add('HANDLER_PATH_INVALID', rel, 'handler is absent from operations.yml');
  else if (rel !== `services/commerce/src/modules/${operation.owner}/application/handler/${path.basename(rel)}`) add('HANDLER_PATH_INVALID', rel, `${operation.owner}`);

  const classes = sourceFile.statements.filter((statement) => ts.isClassDeclaration(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) && statement.name?.text.endsWith('Handler'));
  if (classes.length !== 1) add('HANDLER_CARDINALITY_INVALID', rel, `exported handler classes=${classes.length}`);
  const declaration = classes[0];
  if (declaration && operation) {
    const literal = operationLiteral(declaration);
    if (literal !== operation.id) add('HANDLER_OPERATION_MISMATCH', rel, `${literal ?? '<missing>'}!=${operation.id}`);
    const owner = rel.match(/^services\/commerce\/src\/modules\/([^/]+)\//)?.[1] ?? '';
    const count = assemblyInstantiations.get(`${owner}:${declaration.name.text}`) ?? 0;
    if (count !== 1) add('HANDLER_CARDINALITY_INVALID', rel, `assembly instances=${count}`);
  }
  if (/\bdefineOperationHandler\s*\(|\bOperationUsecase\b|\.invoke\s*\(/.test(source) || handlerIsTrivial(declaration, sourceFile)) add('HANDLER_STUB_FORBIDDEN', rel, 'generic or trivial handler');
  if (/\.query\s*\(/.test(source) || sql.test(source)) add('HANDLER_SQL_FORBIDDEN', rel, 'handler contains SQL capability');
}

function auditPublic(parts, rel, sourceFile, source, add) {
  if (parts[1] !== 'public') return;
  if (publicDatabase.test(source)) add('PUBLIC_DATABASE_TYPE_FORBIDDEN', rel, 'database capability in public contract');
  if (publicResultRow.test(source)) add('PUBLIC_RESULT_ROW_FORBIDDEN', rel, 'database-shaped public result');
  if (sourceFile.statements.some((statement) => ts.isClassDeclaration(statement) || ts.isFunctionDeclaration(statement))) add('PUBLIC_IMPLEMENTATION_FORBIDDEN', rel, 'public contains implementation');
}

function auditRepositories(owner, parts, rel, sourceFile, add) {
  const interfaces = sourceFile.statements.filter((statement) => ts.isInterfaceDeclaration(statement) && statement.name.text.endsWith('Repository'));
  const implementations = sourceFile.statements.filter((statement) => ts.isClassDeclaration(statement) && statement.name?.text.endsWith('Repository'));
  if (interfaces.length && !(parts[1] === 'application' && parts[2] === 'port')) add('REPOSITORY_PATH_INVALID', rel, 'repository interface must be application/port');
  if (implementations.length && !(parts[1] === 'infrastructure' && parts[2] === 'persistence')) add('REPOSITORY_PATH_INVALID', rel, 'repository implementation must be infrastructure/persistence');
  for (const reference of moduleReferences(sourceFile)) {
    if (!reference.target) continue;
    const target = relative(reference.target);
    const match = target.match(/^services\/commerce\/src\/modules\/([^/]+)\/.+Repository\.ts$/);
    if (match && match[1] !== owner) add('REPOSITORY_OWNER_INVALID', `${rel}:${reference.line}`, `${owner}->${match[1]}`);
  }
}

function auditTransactionSafety(parts, rel, sourceFile, source, add) {
  const infrastructureSql = parts[1] === 'infrastructure' && parts[2] === 'persistence';
  const importsRaw = /from\s+['"][^'"]*(?:UnitOfWork|PgTransactionAccess|PgTransactionState|\/pg)(?:\.ts)?['"]|from\s+['"]pg['"]/.test(source);
  const compositionRoot = parts.length === 2 && parts[1] === 'Module.ts';
  if (importsRaw && !infrastructureSql && !compositionRoot) add('RAW_TRANSACTION_IMPORT_FORBIDDEN', rel, 'raw transaction capability outside persistence');

  if (
    containsNode(
      sourceFile,
      (node) =>
        (ts.isPropertyDeclaration(node) && /TransactionContext/.test(node.type?.getText(sourceFile) ?? '')) ||
        (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'stringify' && node.arguments.some(namedContext)) ||
        (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(node.left) && namedContext(node.right))
    )
  ) {
    add('TRANSACTION_CONTEXT_ESCAPE', rel, 'transaction context stored or serialized');
  }

  for (const declaration of sourceFile.statements.filter(ts.isClassDeclaration)) {
    for (const member of declaration.members.filter(ts.isMethodDeclaration)) {
      const name = member.name && propertyName(member.name);
      if (!['execute', 'commit', 'finalize'].includes(name)) continue;
      const external = firstCall(member, (call) => (ts.isIdentifier(call.expression) ? externalMethods.has(call.expression.text) : ts.isPropertyAccessExpression(call.expression) && externalMethods.has(call.expression.name.text)));
      const isHandler = /\/application\/handler\//.test(rel);
      if (external && name !== 'finalize' && isHandler) add('EXTERNAL_CALL_IN_TRANSACTION', rel, `${name}:${external.expression.getText(sourceFile)}`);
      if (name === 'finalize' && /\b(?:TransactionContext|PgTransactionAccess|OperationDatabase)\b|\.query\s*\(|this\.(?:repository|repo|database)\b/i.test(member.getText(sourceFile)))
        add('TRANSACTION_CONTEXT_ESCAPE', rel, 'finalize references persistence capability');
    }
  }
}

function auditName(rel, add) {
  if (!rel.startsWith('services/commerce/src/modules/')) return;
  const directoryPattern = new RegExp(namingPolicy.production.directory);
  const filePattern = new RegExp(namingPolicy.production.file);
  const parts = rel.split('/').slice(4);
  const file = parts.pop();
  if (parts.some((part) => !directoryPattern.test(part)) || !filePattern.test(file)) add('PRODUCTION_NAME_INVALID', rel, 'name violates config/naming.yml');
}

function handlerInstantiations(sources, sourceMap) {
  const counts = new Map();
  for (const file of sources.filter((candidate) => path.basename(candidate) === 'Module.ts')) {
    const sourceFile = sourceMap.get(fs.realpathSync.native(file));
    if (!sourceFile) continue;
    const owner = path.basename(path.dirname(file));
    const visit = (node) => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text.endsWith('Handler')) {
        const key = `${owner}:${node.expression.text}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return counts;
}

function operationLiteral(declaration) {
  const property = declaration.members.find((member) => ts.isPropertyDeclaration(member) && propertyName(member.name) === 'operation');
  const value = property?.initializer;
  if (value && ts.isStringLiteralLike(value)) return value.text;
  if (value && ts.isAsExpression(value) && ts.isStringLiteralLike(value.expression)) return value.expression.text;
  return undefined;
}

function handlerIsTrivial(declaration, sourceFile) {
  if (!declaration) return false;
  const method = declaration.members.find((member) => ts.isMethodDeclaration(member) && ['execute', 'commit'].includes(propertyName(member.name)));
  if (!method?.body) return true;
  const text = method.body.getText(sourceFile);
  return method.body.statements.length <= 1 && /return\s+this\.[a-zA-Z0-9_]+\.(?:execute|invoke|handle)\s*\(/.test(text);
}

function containsNode(node, predicate) {
  let found = false;
  const visit = (current) => {
    if (predicate(current)) found = true;
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function firstNode(node, predicate) {
  let found;
  const visit = (current) => {
    if (!found && predicate(current)) found = current;
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function containsCallOtherThan(sourceFile, allowed) {
  return containsNode(sourceFile, (node) => {
    if (!ts.isCallExpression(node)) return false;
    if (ts.isIdentifier(node.expression)) return !allowed.has(node.expression.text);
    if (ts.isPropertyAccessExpression(node.expression)) return !allowed.has(node.expression.name.text);
    return true;
  });
}

function firstCall(node, predicate) {
  let found;
  const visit = (current) => {
    if (!found && ts.isCallExpression(current) && predicate(current)) found = current;
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function namedContext(node) {
  return ts.isIdentifier(node) && /^(?:context|transaction)$/.test(node.text);
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  return undefined;
}

function isTestFile(name) {
  return /\.(?:test|spec)\.[^.]+$/.test(name);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const findings = auditBoundaries();
  const groups = Map.groupBy(findings, (finding) => finding.code);
  for (const code of architectureDiagnostics) {
    const group = groups.get(code) ?? [];
    if (!group.length) continue;
    console.log(`\n[${code}] ${group.length}`);
    for (const finding of group.slice(0, 30)) console.log(`  ${finding.file}  ${finding.detail}`);
    if (group.length > 30) console.log(`  ... ${group.length - 30} more`);
  }
  console.log(`\nboundary findings: ${findings.length}`);
  process.exit(findings.length > 0 ? 1 : 0);
}
