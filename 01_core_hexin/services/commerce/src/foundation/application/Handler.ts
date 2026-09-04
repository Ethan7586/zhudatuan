export interface Handler<TRequest, TResponse> {
  handle(request: TRequest): Promise<TResponse>;
}
