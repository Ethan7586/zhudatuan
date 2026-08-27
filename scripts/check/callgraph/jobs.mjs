import fs from 'node:fs';
import path from 'node:path';

import { relative, root, ts } from '../source.mjs';
import { literalText, objectProperties, target, unique, violation } from './catalog.mjs';

export function auditJobs(sourceFiles, sourceSet) {
  const registryName = path.join(root, 'services/commerce/src/app/jobs.ts');
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
        const worker = literalText(properties.get('worker'));
        if (worker) target(values, 'JOB_WORKER', location, id, worker, sourceSet, { name: 'worker', bind: false });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!registrations) values.push(violation('JOB_REGISTRY_EMPTY', relative(registryName), 'registerJob/defineJob'));
  return values;
}
