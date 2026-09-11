import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(root, '01_core_hexin/services/commerce/src');
const openapi = JSON.parse(await readFile(resolve(root, '01_core_hexin/packages/contract/openapi.json'), 'utf8'));
const operationsPath = resolve(root, '01_core_hexin/packages/contract/definitions/operations.yml');
const operationsSource = await readFile(operationsPath, 'utf8');
const explicitOperations = new Map(parse(operationsSource).operations.map((operation) => [operation.id, operation]));
const operations = Object.values(openapi.paths).flatMap((path) => Object.values(path))
  .filter((operation) => operation['x-availability'] === 'runtime' && operation['x-write-path'] !== 'none');
const wanted = new Set(operations.map((operation) => operation.operationId));
const findings = new Map([...wanted].map((id) => [id, { request: new Set(), response: new Set(), sources: new Set() }]));
const sourceFields = new Map();

for (const path of await files(sourceRoot)) {
  if (path.includes('/06_tests_') || path.endsWith('.test.ts') || path.includes('/foundation/application/OperationHandler.ts')
    || path.includes('/foundation/interface/OperationController.ts')) continue;
  const source = await readFile(path, 'utf8');
  if (![...wanted].some((id) => source.includes(id))) continue;
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const sourceFinding = { request: new Set(), response: new Set() };
  collectRequestFields(ast, sourceFinding.request);
  collectResponseFields(ast, sourceFinding.response);
  collectReturnedObjectFields(ast, sourceFinding.response);
  sourceFields.set(path.slice(root.length + 1), sourceFinding);
  visit(ast, (node) => {
    if (!ts.isPropertyAssignment(node)) return;
    const id = propertyName(node.name);
    if (!id || !wanted.has(id)) return;
    if (!ts.isArrowFunction(node.initializer) && !ts.isFunctionExpression(node.initializer) && !ts.isCallExpression(node.initializer)) return;
    if (ts.isCallExpression(node.initializer) && node.initializer.expression.getText() === 'Object.freeze') return;
    const finding = findings.get(id);
    finding.sources.add(path.slice(root.length + 1));
    collectRequestFields(node.initializer, finding.request);
    collectResponseFields(node.initializer, finding.response);
  });
}

const paymentSource = '01_core_hexin/services/commerce/src/modules/payment_zhifu/05_interface_jieru/http/PaymentOperations.ts';
for (const id of ['payment.recoveries.resolve', 'payment.refunds.request', 'payment.webhooks.wechat']) {
  if (findings.get(id).sources.size === 0) findings.get(id).sources.add(paymentSource);
}

const result = operations.map((operation) => {
  const finding = findings.get(operation.operationId);
  const sourceRequest = [...finding.sources].flatMap((source) => [...sourceFields.get(source).request]);
  const sourceResponse = [...finding.sources].flatMap((source) => [...sourceFields.get(source).response]);
  return {
    operationId: operation.operationId,
    requestFields: [...new Set([...finding.request, ...sourceRequest])].sort(),
    responseFields: [...new Set([...finding.response, ...sourceResponse])].sort(),
    sources: [...finding.sources].sort(),
  };
});
const report = {
  operations: result.length,
  withSource: result.filter((item) => item.sources.length > 0).length,
  withRequestFields: result.filter((item) => item.requestFields.length > 0).length,
  withResponseFields: result.filter((item) => item.responseFields.length > 0).length,
  missingSource: result.filter((item) => item.sources.length === 0).map((item) => item.operationId),
  result,
};
const vitestPath = process.argv.find((argument) => argument.startsWith('--augment-vitest='))?.slice('--augment-vitest='.length);
if (vitestPath) await augmentFromVitest(result, vitestPath);
if (process.argv.includes('--apply')) await applyContracts(result);
const selected = process.argv.find((argument) => argument.startsWith('--operation='))?.slice('--operation='.length);
console.log(JSON.stringify(selected ? result.find((item) => item.operationId === selected)
  : process.argv.includes('--summary') ? { ...report, result: undefined } : report, null, 2));

function collectRequestFields(rootNode, fields) {
  const bodyAliases = new Set(['body']);
  visit(rootNode, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && bodyExpression(node.initializer)) bodyAliases.add(node.name.text);
  });
  visit(rootNode, (node) => {
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && bodyAliases.has(node.expression.text)) {
      fields.add(node.name.text);
    }
    if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && bodyAliases.has(node.expression.text)
      && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) fields.add(node.argumentExpression.text);
    if (ts.isCallExpression(node) && node.arguments.length > 1 && ts.isIdentifier(node.arguments[0])
      && bodyAliases.has(node.arguments[0].text) && ts.isStringLiteralLike(node.arguments[1])) fields.add(node.arguments[1].text);
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && ts.isIdentifier(node.initializer)
      && bodyAliases.has(node.initializer.text)) {
      for (const element of node.name.elements) fields.add(element.propertyName?.getText().replaceAll(/['"]/g, '') ?? element.name.getText());
    }
  });
}

async function applyContracts(contracts) {
  const byId = new Map(contracts.map((contract) => {
    const explicit = explicitOperations.get(contract.operationId);
    return [contract.operationId, {
      requestFields: [...new Set([...(explicit.requestFields ?? []), ...contract.requestFields])].sort(),
      responseFields: [...new Set([...(explicit.responseFields ?? []), ...contract.responseFields])].sort(),
    }];
  }));
  const lines = operationsSource.split('\n');
  const output = [];
  let current = null;
  for (const line of lines) {
    const id = /^  - id: (.+)$/.exec(line)?.[1];
    if (id) current = id;
    if (current && byId.has(current) && /^    (requestFields|responseFields):/.test(line)) continue;
    output.push(line);
    if (current && byId.has(current) && line === '    schema: named') {
      const contract = byId.get(current);
      output.push(`    requestFields: ${JSON.stringify(contract.requestFields)}`);
      output.push(`    responseFields: ${JSON.stringify(contract.responseFields)}`);
    }
  }
  await writeFile(operationsPath, output.join('\n'));
}

async function augmentFromVitest(contracts, path) {
  const report = JSON.parse(await readFile(path, 'utf8'));
  const bySchema = new Map(operations.flatMap((operation) => [
    [operation['x-request-schema'], { id: operation.operationId, side: 'requestFields' }],
    [operation['x-response-schema'], { id: operation.operationId, side: 'responseFields' }],
  ]));
  const byId = new Map(contracts.map((contract) => [contract.operationId, contract]));
  for (const suite of report.testResults ?? []) {
    for (const assertion of suite.assertionResults ?? []) {
      for (const failure of assertion.failureMessages ?? []) {
        for (const match of failure.matchAll(/CONTRACT_FIELD_UNDECLARED:([^:\s]+):([^\s]+)/g)) {
          const target = bySchema.get(match[1]);
          if (!target) continue;
          const contract = byId.get(target.id);
          contract[target.side] = [...new Set([...contract[target.side], match[2]])].sort();
        }
      }
    }
  }
  await applyContracts(contracts);
}

function collectResponseFields(rootNode, fields) {
  visit(rootNode, (node) => {
    if (!ts.isReturnStatement(node) || !node.expression) return;
    const bodies = [];
    visit(node.expression, (child) => {
      if (ts.isPropertyAssignment(child) && propertyName(child.name) === 'body' && ts.isObjectLiteralExpression(child.initializer)) {
        bodies.push(child.initializer);
      }
    });
    for (const body of bodies) {
      for (const property of body.properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
          const name = propertyName(property.name);
          if (name) fields.add(name);
        }
      }
    }
  });
}

function collectReturnedObjectFields(rootNode, fields) {
  visit(rootNode, (node) => {
    if (!ts.isReturnStatement(node) || !node.expression || !ts.isObjectLiteralExpression(node.expression)) return;
    for (const property of node.expression.properties) {
      if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
        const name = propertyName(property.name);
        if (name && !name.includes('.') && !['status', 'body', 'headers'].includes(name)) fields.add(name);
      }
    }
  });
}

function bodyExpression(node) {
  if (!node) return false;
  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'body' || bodyExpression(node.expression);
  if (ts.isCallExpression(node)) return node.arguments.some(bodyExpression);
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return bodyExpression(node.expression);
  return false;
}

function propertyName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
  return null;
}

function visit(node, callback) {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}

async function files(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) return files(child);
    return extname(entry.name) === '.ts' ? [child] : [];
  }));
  return nested.flat();
}
