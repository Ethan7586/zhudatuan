import fs from 'node:fs';
import path from 'node:path';

import { relative, root, ts } from '../source.mjs';
import { asArray, idOf, readCatalog, sourceReferencesId, target, unique, violation } from './catalog.mjs';

export function auditOperations(sourceSet, testSet) {
  const catalog = readCatalog('packages/contract/definitions/operations.yml', ['operations']);
  if (catalog.entries === undefined) return catalog.violations;
  const values = [...catalog.violations];
  const seen = new Set();
  const instantiations = handlerInstantiations(sourceSet);
  catalog.entries.forEach((entry, index) => {
    const location = `${relative(catalog.file)}:${index + 1}`;
    const id = idOf(entry, ['id', 'operation']);
    if (!unique(values, seen, 'OPERATION', location, id)) return;
    if (typeof entry.owner !== 'string' || !entry.owner) values.push(violation('OPERATION_OWNER_MISSING', location, id));
    if (!asArray(entry.requirements).length) values.push(violation('OPERATION_REQUIREMENT_MISSING', location, id));
    target(values, 'OPERATION', location, id, entry.controller, sourceSet, { name: 'controller' });
    target(values, 'OPERATION', location, id, entry.handler, sourceSet, { name: 'handler' });
    auditHandler(values, location, id, entry, sourceSet, instantiations);
    target(values, 'OPERATION', location, id, entry.sdk, sourceSet, { name: 'sdk' });
    for (const reference of asArray(entry.tests ?? entry.testReferences)) {
      const test = typeof reference === 'string' ? path.resolve(root, reference) : undefined;
      if (!test || !testSet.has(test)) {
        values.push(violation('OPERATION_TEST_MISSING', location, `${id}:${String(reference)}`));
      } else if (!sourceReferencesId(test, id)) {
        values.push(violation('OPERATION_TEST_NOT_BOUND', relative(test), id));
      }
    }
    if (entry.route && typeof entry.route === 'object' && !Array.isArray(entry.route)) {
      target(values, 'ROUTE', location, id, entry.route.page, sourceSet, { name: 'page', bind: false });
    }
  });
  return values;
}

function auditHandler(values, location, id, entry, sourceSet, instantiations) {
  if (typeof entry.handler !== 'string' || typeof entry.owner !== 'string') return;
  const expectedPrefix = `services/commerce/src/modules/${entry.owner}/application/handler/`;
  if (!entry.handler.startsWith(expectedPrefix)) values.push(violation('HANDLER_PATH_INVALID', location, `${id}:${entry.handler}`));
  const file = path.resolve(root, entry.handler);
  if (!sourceSet.has(file) && !fs.existsSync(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
  const expectedClass = path.basename(file, path.extname(file));
  const classes = sourceFile.statements.filter((statement) => ts.isClassDeclaration(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) && statement.name?.text.endsWith('Handler'));
  if (classes.length !== 1) {
    values.push(violation('HANDLER_CARDINALITY_INVALID', relative(file), `${id}:classes=${classes.length}`));
    return;
  }
  const declaration = classes[0];
  if (declaration.name.text !== expectedClass) values.push(violation('HANDLER_CLASS_INVALID', relative(file), `${declaration.name.text}!=${expectedClass}`));
  const property = declaration.members.find((member) => ts.isPropertyDeclaration(member) && member.name && propertyName(member.name) === 'operation');
  const operation = literal(property?.initializer);
  if (operation !== id) values.push(violation('HANDLER_OPERATION_MISMATCH', relative(file), `${operation ?? '<missing>'}!=${id}`));
  if (/\bdefineOperationHandler\s*\(|\bOperationUsecase\b|\.invoke\s*\(/.test(source)) values.push(violation('HANDLER_STUB_FORBIDDEN', relative(file), id));
  const count = instantiations.get(`${entry.owner}:${declaration.name.text}`) ?? 0;
  if (count !== 1) values.push(violation('HANDLER_ASSEMBLY_INVALID', relative(file), `${id}:instances=${count}`));
}

function handlerInstantiations(sourceSet) {
  const values = new Map();
  for (const file of sourceSet) {
    if (path.basename(file) !== 'Module.ts') continue;
    const parts = relative(file).split('/');
    const owner = parts[0] === 'services' && parts[1] === 'commerce' && parts[2] === 'src' && parts[3] === 'modules' ? parts[4] : undefined;
    if (!owner) continue;
    const source = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true);
    const visit = (node) => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text.endsWith('Handler')) {
        const key = `${owner}:${node.expression.text}`;
        values.set(key, (values.get(key) ?? 0) + 1);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return values;
}

function propertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : undefined;
}

function literal(node) {
  if (node && ts.isStringLiteralLike(node)) return node.text;
  if (node && ts.isAsExpression(node) && ts.isStringLiteralLike(node.expression)) return node.expression.text;
  return undefined;
}
