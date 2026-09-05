import { relative } from '../source.mjs';
import { asArray, idOf, readCatalog, target, unique, violation } from './catalog.mjs';

const handlerTargets = Object.freeze({
  experiencepublish: '01_core_hexin/services/commerce/src/modules/experience/ExperienceJobs.ts',
  notification: '01_core_hexin/services/commerce/src/modules/notification/interface/job/NotificationJob.ts',
  projection: '01_core_hexin/services/commerce/src/modules/reporting/interface/job/ProjectionJob.ts',
  reconciliation: '01_core_hexin/services/commerce/src/modules/finance/05_interface_jieru/job/ReconciliationJob.ts',
  referral: '01_core_hexin/services/commerce/src/modules/referral/05_interface_jieru/job/ReferralEventJob.ts',
});
const handlerRegistry = '01_core_hexin/services/commerce/src/app/events.ts';

export function auditEvents(sourceSet) {
  const catalog = readCatalog('01_core_hexin/packages/contract/definitions/events.yml', ['events']);
  if (catalog.entries === undefined) return catalog.violations;
  const values = [...catalog.violations];
  const seen = new Set();
  catalog.entries.forEach((entry, index) => {
    const location = `${relative(catalog.file)}:${index + 1}`;
    const id = idOf(entry, ['id', 'type', 'event']);
    if (!unique(values, seen, 'EVENT', location, id)) return;
    for (const field of ['owner', 'version', 'schema']) {
      if (entry[field] === undefined || entry[field] === '') values.push(violation(`EVENT_${field.toUpperCase()}_MISSING`, location, id));
    }
    target(values, 'EVENT_SERIALIZER', location, id, entry.serializer, sourceSet, { name: 'serializer' });
    target(values, 'EVENT_SCHEMA_REGISTRY', location, id, entry.schemaRegistry, sourceSet, { name: 'schemaRegistry' });
    for (const handler of asArray(entry.handlers)) {
      const value = typeof handler === 'string' ? { file: handlerTargets[handler], registry: handlerRegistry } : handler;
      if (typeof handler === 'string' && !handlerTargets[handler]) values.push(violation('EVENT_HANDLER_KIND_UNKNOWN', location, `${id}:${handler}`));
      target(values, 'EVENT_HANDLER', location, id, value?.file, sourceSet, { name: 'handler', bind: false });
      target(values, 'EVENT_REGISTRY', location, id, value?.registry ?? entry.handlerRegistry, sourceSet, { name: 'registry' });
    }
  });
  return values;
}
