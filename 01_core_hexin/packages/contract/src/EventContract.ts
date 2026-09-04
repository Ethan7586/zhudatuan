export interface EventContract<TPayload = unknown> {
  readonly type: string;
  readonly version: number;
  readonly module: string;
  readonly payload?: TPayload;
}

export function eventContract<const T extends EventContract>(definition: T): Readonly<T> {
  if (!/^[a-z]+(?:\.[a-z]+)+$/.test(definition.type)) throw new Error('EVENT_TYPE_INVALID');
  if (!Number.isSafeInteger(definition.version) || definition.version < 1) throw new Error('EVENT_VERSION_INVALID');
  return Object.freeze({ ...definition });
}
