export function productOutput(record: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  if (record.attributes === null || typeof record.attributes !== 'object' || Array.isArray(record.attributes)) return Object.freeze({ ...record });
  const attributes = { ...(record.attributes as Readonly<Record<string, unknown>>) };
  delete attributes.coverObject;
  return Object.freeze({ ...record, attributes: Object.freeze(attributes) });
}
