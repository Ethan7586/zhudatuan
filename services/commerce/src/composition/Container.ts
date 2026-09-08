export type Token<T> = Readonly<{ key: string; type?: T }>;

export function token<T>(key: string): Token<T> {
  return Object.freeze({ key });
}

export class Container {
  private readonly values = new Map<string, unknown>();
  private frozen = false;

  bind<T>(key: Token<T>, value: T): void {
    if (this.frozen) throw new Error('CONTAINER_FROZEN');
    if (this.values.has(key.key)) throw new Error(`CONTAINER_BINDING_DUPLICATE:${key.key}`);
    this.values.set(key.key, value);
  }

  get<T>(key: Token<T>): T {
    if (!this.values.has(key.key)) throw new Error(`CONTAINER_BINDING_MISSING:${key.key}`);
    return this.values.get(key.key) as T;
  }

  freeze(): void {
    this.frozen = true;
  }
}
