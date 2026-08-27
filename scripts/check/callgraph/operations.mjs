import path from 'node:path';

import { relative, root } from '../source.mjs';
import { asArray, idOf, readCatalog, sourceReferencesId, target, unique, violation } from './catalog.mjs';

export function auditOperations(sourceSet, testSet) {
  const catalog = readCatalog('packages/contract/definitions/operations.yml', ['operations']);
  if (catalog.entries === undefined) return catalog.violations;
  const values = [...catalog.violations];
  const seen = new Set();
  catalog.entries.forEach((entry, index) => {
    const location = `${relative(catalog.file)}:${index + 1}`;
    const id = idOf(entry, ['id', 'operation']);
    if (!unique(values, seen, 'OPERATION', location, id)) return;
    if (typeof entry.owner !== 'string' || !entry.owner) values.push(violation('OPERATION_OWNER_MISSING', location, id));
    if (!asArray(entry.requirements).length) values.push(violation('OPERATION_REQUIREMENT_MISSING', location, id));
    target(values, 'OPERATION', location, id, entry.controller, sourceSet, { name: 'controller' });
    target(values, 'OPERATION', location, id, entry.handler, sourceSet, { name: 'handler' });
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
