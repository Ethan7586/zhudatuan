export interface DatabaseFixture {
  readonly name: string;
  readonly apply: () => Promise<void>;
  readonly reset: () => Promise<void>;
}

export class DatabaseHarness {
  constructor(private readonly fixture: DatabaseFixture) {}

  async run<T>(test: () => Promise<T>): Promise<T> {
    await this.fixture.apply();
    try {
      return await test();
    } finally {
      await this.fixture.reset();
    }
  }
}
