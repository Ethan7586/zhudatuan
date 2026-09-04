export interface InappConfiguration {
  readonly maxBatchSize: number;
}

export function parseInappConfiguration(value: unknown = {}): InappConfiguration {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INAPP_CONFIGURATION_INVALID');
  }
  const source = value as Readonly<Record<string, unknown>>;
  if (Object.keys(source).some((key) => key !== 'maxBatchSize')) throw new Error('INAPP_CONFIGURATION_INVALID');
  const maxBatchSize = source.maxBatchSize === undefined ? 200 : Number(source.maxBatchSize);
  if (!Number.isSafeInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > 1_000) throw new Error('INAPP_CONFIGURATION_INVALID');
  return Object.freeze({ maxBatchSize });
}
