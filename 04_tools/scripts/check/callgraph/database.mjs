import path from 'node:path';

import { relative, root } from '../source.mjs';
import { asArray, idOf, readCatalog, sourceReferencesId, unique, violation } from './catalog.mjs';

export function auditDatabase(sourceSet) {
  const catalog = readCatalog('02_platform_pingtai/database/contracts/objects.yml', ['objects']);
  if (catalog.entries === undefined) return catalog.violations;
  const values = [...catalog.violations];
  const seen = new Set();
  catalog.entries.forEach((entry, index) => {
    const location = `${relative(catalog.file)}:${index + 1}`;
    const id = idOf(entry, ['id', 'name']);
    if (!unique(values, seen, 'DATABASE_OBJECT', location, id)) return;
    if (entry.kind !== 'function') return;
    const callers = asArray(entry.callers);
    if (!callers.length && !entry.operationalOwner) values.push(violation('DATABASE_FUNCTION_ORPHAN', location, id));
    for (const caller of callers) {
      const file = typeof caller === 'string' ? path.resolve(root, caller) : undefined;
      if (!file || !sourceSet.has(file)) values.push(violation('DATABASE_CALLER_MISSING', location, `${id}:${String(caller)}`));
      else if (!sourceReferencesId(file, id)) values.push(violation('DATABASE_CALLER_NOT_BOUND', relative(file), id));
    }
  });
  return values;
}
