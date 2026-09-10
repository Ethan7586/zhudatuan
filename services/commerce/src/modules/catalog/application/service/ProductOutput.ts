export function productOutput<T extends Readonly<Record<string, unknown>>>(record: T): T {
  if (record.attributes === null || typeof record.attributes !== 'object' || Array.isArray(record.attributes)) return Object.freeze({ ...record }) as T;
  const attributes = { ...(record.attributes as Readonly<Record<string, unknown>>) };
  delete attributes.coverObject;
  return Object.freeze({ ...record, attributes: Object.freeze(attributes) }) as T;
}
