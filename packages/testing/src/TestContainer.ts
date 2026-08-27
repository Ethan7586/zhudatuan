declare const tokenType: unique symbol;

export interface TestToken<T> {
  readonly key: symbol;
  readonly description: string;
  readonly [tokenType]?: T;
}

export function createTestToken<T>(description: string): TestToken<T> {
  return Object.freeze({ key: Symbol(description), description });
}

export class TestContainer {
  private readonly values = new Map<symbol, unknown>();

  bind<T>(token: TestToken<T>, value: T): this {
    if (this.values.has(token.key)) throw new Error(`TEST_BINDING_DUPLICATE:${token.description}`);
    this.values.set(token.key, value);
    return this;
  }

  has<T>(token: TestToken<T>): boolean {
    return this.values.has(token.key);
  }

  get<T>(token: TestToken<T>): T {
    if (!this.values.has(token.key)) throw new Error(`TEST_BINDING_MISSING:${token.description}`);
    return this.values.get(token.key) as T;
  }
}
