export interface HttpResponse<T = unknown> {
  readonly status: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: T;
}

export function json<T>(status: number, body: T, headers: Readonly<Record<string, string>> = {}): HttpResponse<T> {
  if (status === 204) return { status, headers };
  return { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers }, body };
}
