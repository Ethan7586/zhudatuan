import { createHash } from 'node:crypto';

export function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

export function prettyStableJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function digest(value) {
  return `sha256:${sha256(typeof value === 'string' || Buffer.isBuffer(value) ? value : stableJson(value))}`;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}
