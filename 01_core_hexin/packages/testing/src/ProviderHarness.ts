export interface ProviderExchange<TRequest, TResponse> {
  readonly match: (request: TRequest) => boolean;
  readonly response: TResponse | Error;
}

export class ProviderHarness<TRequest, TResponse> {
  constructor(private readonly exchanges: readonly ProviderExchange<TRequest, TResponse>[]) {}

  execute(request: TRequest): Promise<TResponse> {
    const exchange = this.exchanges.find((candidate) => candidate.match(request));
    if (!exchange) return Promise.reject(new Error('PROVIDER_FIXTURE_MISSING'));
    return exchange.response instanceof Error ? Promise.reject(exchange.response) : Promise.resolve(exchange.response);
  }
}
