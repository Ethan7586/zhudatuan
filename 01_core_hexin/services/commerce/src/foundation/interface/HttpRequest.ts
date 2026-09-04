export interface HttpRequest<T = unknown> {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly parameters: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  readonly body: T;
  readonly rawBody: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
}
