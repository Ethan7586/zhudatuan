export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

declare const process: { readonly env: EnvironmentSource } | undefined;

export function processEnvironment(): EnvironmentSource {
  if (typeof process === 'undefined') throw new Error('NODE_ENVIRONMENT_UNAVAILABLE');
  return process.env;
}

export function browserEnvironment(): EnvironmentSource {
  const environment = (import.meta as ImportMeta & { readonly env?: EnvironmentSource }).env;
  if (!environment) throw new Error('BROWSER_ENVIRONMENT_UNAVAILABLE');
  return environment;
}

export function pickEnvironment<const K extends readonly string[]>(source: EnvironmentSource, keys: K): Readonly<Partial<Record<K[number], string>>> {
  const values: Partial<Record<K[number], string>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) values[key as K[number]] = value;
  }
  return Object.freeze(values);
}

export function requiredValue(value: string | undefined, code: string): string {
  if (!value?.trim()) throw new Error(code);
  return value.trim();
}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
export function bearerToken(value: string | undefined, code: string): string {
  const normalized = requiredValue(value, code);
  if (normalized.length < 43 || normalized.length > 512 || normalized.length % 4 === 1
    || !/^[A-Za-z0-9_-]+$/.test(normalized)) throw new Error(code);
  return normalized;
}

export function distinctValues(left: string, right: string, code: string): void {
  if (left === right) throw new Error(code);
}

<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
export function integerValue(value: string | undefined, fallback: number, minimum: number, maximum: number, code: string): number {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) throw new Error(code);
  return parsed;
}

export function enumValue<T extends string>(value: string | undefined, allowed: readonly T[], code: string): T {
  const normalized = requiredValue(value, code);
  if (!allowed.includes(normalized as T)) throw new Error(code);
  return normalized as T;
}

export function minimumLength(value: string | undefined, length: number, code: string): string {
  const normalized = requiredValue(value, code);
  if (normalized.length < length) throw new Error(code);
  return normalized;
}

export function base64ByteLength(value: string): number {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return -1;
  return (value.length / 4) * 3 - (value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0);
}
