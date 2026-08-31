export class IntegrationFailure extends Error {
  constructor(
    readonly code: string,
    readonly retryable: boolean,
    readonly status?: number,
    options?: ErrorOptions
  ) {
    super(code, options);
    this.name = 'IntegrationFailure';
  }
}

export function asIntegrationFailure(error: unknown): IntegrationFailure {
  if (error instanceof IntegrationFailure) return error;
  if (error instanceof Error && error.message === 'DEADLINE_EXCEEDED') return new IntegrationFailure('PROVIDER_DEADLINE_EXCEEDED', false, undefined, { cause: error });
  return new IntegrationFailure('PROVIDER_TRANSPORT_FAILED', true, undefined, { cause: error });
}
