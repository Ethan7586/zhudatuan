export type InappConfiguration = Readonly<Record<never, never>>;

export function parseInappConfiguration(value: unknown = {}): InappConfiguration {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 0) {
    throw new Error('INAPP_CONFIGURATION_INVALID');
  }
  return Object.freeze({});
}
