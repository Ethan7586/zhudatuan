import { readFile } from 'node:fs/promises';

const REFERENCE = /^[a-z][a-z0-9./-]{2,255}$/;

export class SecretCatalog {
  private constructor(private readonly values: ReadonlyMap<string, string>) {}

  static async load(path: string): Promise<SecretCatalog> {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('LOCAL_SECRETS_INVALID');
    const entries = Object.entries(parsed as Readonly<Record<string, unknown>>);
    if (entries.length === 0 || entries.some(([reference, value]) => !REFERENCE.test(reference) || typeof value !== 'string' || value.length === 0)) {
      throw new Error('LOCAL_SECRETS_INVALID');
    }
    return new SecretCatalog(new Map(entries as ReadonlyArray<readonly [string, string]>));
  }

  get(reference: string): string | undefined {
    if (!REFERENCE.test(reference)) return undefined;
    return this.values.get(reference);
  }
}
