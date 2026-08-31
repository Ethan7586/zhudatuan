export interface IntegrationAuthInput {
  readonly method: string;
  readonly path: string;
  readonly body: string;
  readonly timestamp: string;
  readonly nonce: string;
}

export interface IntegrationAuthenticator {
  authenticate(input: IntegrationAuthInput): Promise<Readonly<Record<string, string>>>;
}

export class HeaderAuthenticator implements IntegrationAuthenticator {
  constructor(
    private readonly header: string,
    private readonly value: string
  ) {
    if (!header.trim() || !value.trim()) throw new Error('PROVIDER_AUTH_INVALID');
  }

  authenticate(): Promise<Readonly<Record<string, string>>> {
    return Promise.resolve(Object.freeze({ [this.header]: this.value }));
  }
}
