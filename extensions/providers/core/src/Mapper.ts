import type { JsonObject, JsonValue } from '@shop/contract';

export class ProviderMapper {
  constructor(private readonly recordKeys: readonly string[] = []) {}

  object(value: JsonValue | undefined, code: string): JsonObject {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
    return value as JsonObject;
  }

  objects(value: JsonValue | undefined, code: string): readonly JsonObject[] {
    if (!Array.isArray(value)) throw new Error(code);
    return value.map((item) => {
      const record = this.object(item, code);
      if (this.recordKeys.some((key) => record[key] === undefined)) throw new Error(`${code}_FIELD_MISSING`);
      return record;
    });
  }

  string(value: JsonValue | undefined, code: string): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error(code);
    return value;
  }

  boolean(value: JsonValue | undefined, code: string): boolean {
    if (typeof value !== 'boolean') throw new Error(code);
    return value;
  }
}

export class CanonicalSourceMapper extends ProviderMapper {
  constructor() {
    super(['externalId', 'version', 'payload']);
  }
}
