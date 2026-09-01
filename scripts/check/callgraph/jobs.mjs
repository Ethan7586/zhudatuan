import fs from 'node:fs';
import path from 'node:path';

import { isTest, location, moduleReferences, relative, root, ts } from '../source.mjs';
import { literalText, objectProperties, target, unique, violation } from './catalog.mjs';

export function auditJobs(sourceFiles, sourceSet) {
  const registryName = path.join(root, 'services/commerce/src/foundation/application/JobCatalog.ts');
  if (!fs.existsSync(registryName)) return [violation('JOB_REGISTRY_MISSING', relative(registryName), 'jobs')];
  const sourceFile = sourceFiles.get(registryName);
  if (!sourceFile) return [violation('JOB_REGISTRY_UNPARSED', relative(registryName), 'not in TypeScript program')];
  const values = [];
  const seen = new Set();
  let registrations = 0;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const expressionName = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : undefined;
      if (['registerJob', 'defineJob'].includes(expressionName) && ts.isObjectLiteralExpression(node.arguments[0])) {
        registrations += 1;
        const properties = objectProperties(node.arguments[0], sourceFile);
        const id = literalText(properties.get('id'));
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const location = `${relative(registryName)}:${position.line + 1}`;
        if (!unique(values, seen, 'JOB', location, id)) return;
        for (const field of ['owner', 'queue', 'concurrency', 'timeout', 'retry', 'lease', 'idempotency', 'deadLetter', 'runbook', 'worker']) {
          if (!properties.has(field)) values.push(violation('JOB_FIELD_MISSING', location, `${id}:${field}`));
        }
        const runbook = literalText(properties.get('runbook'));
        if (!runbook || !runbook.startsWith('docs/operations/') || !fs.existsSync(path.join(root, runbook))) {
          values.push(violation('JOB_RUNBOOK_INVALID', location, `${id}:${runbook ?? 'missing'}`));
        }
        const worker = literalText(properties.get('worker'));
        if (worker) target(values, 'JOB_WORKER', location, id, worker, sourceSet, { name: 'worker', bind: false });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!registrations) values.push(violation('JOB_REGISTRY_EMPTY', relative(registryName), 'registerJob/defineJob'));
  auditModuleJobs(values, sourceFiles);
  return values;
}

function auditModuleJobs(values, sourceFiles) {
  const moduleRoot = 'services/commerce/src/modules/';
  for (const [file, sourceFile] of sourceFiles) {
    const name = relative(file);
    if (!name.startsWith(moduleRoot) || !name.endsWith('.ts') || isTest(file)) continue;
    const isJobEntry = name.includes('/interface/job/') && path.basename(name) !== 'JobFactory.ts';
    if (path.basename(name) === 'JobFactory.ts' && !name.includes('/interface/job/')) {
      values.push(violation('JOB_FACTORY_PATH_INVALID', name, 'must be under interface/job'));
    }
    for (const reference of moduleReferences(sourceFile)) {
      if (isJobEntry && (reference.specifier.includes('/infrastructure/') || /foundation\/persistence\/(?:Pool|TransactionContext|TransactionManager)$/.test(reference.specifier))) {
        values.push(violation('JOB_ENTRY_DEPENDENCY_INVALID', `${name}:${reference.line}`, reference.specifier));
      }
    }
    let hasProcessor = false;
    let hasProcessDependency = false;
    const visit = (node) => {
      if (ts.isClassDeclaration(node) && implementsProcessor(node, sourceFile)) {
        hasProcessor = true;
        if (!name.includes('/interface/job/')) values.push(violation('JOB_PROCESSOR_PATH_INVALID', location(sourceFile, node), 'must be under interface/job'));
      }
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier) && node.moduleSpecifier.text.includes('/application/process/')) hasProcessDependency = true;
      if (isJobEntry && (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /\b(?:select|insert|update|delete)\s+(?:from|into|[a-z])/i.test(node.text)) {
        values.push(violation('JOB_ENTRY_SQL_FORBIDDEN', location(sourceFile, node), node.text.slice(0, 80)));
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    if (hasProcessor && !hasProcessDependency) values.push(violation('JOB_PROCESS_DEPENDENCY_MISSING', name, 'application/process'));
  }
}

function implementsProcessor(node, sourceFile) {
  return (node.heritageClauses ?? []).some((clause) => clause.token === ts.SyntaxKind.ImplementsKeyword && clause.types.some((type) => type.expression.getText(sourceFile) === 'JobProcessor'));
}
