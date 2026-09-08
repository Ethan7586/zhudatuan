export function failureLog(cause: unknown): Readonly<Record<string, unknown>> {
  const error = cause instanceof Error ? cause : undefined;
  const root = error?.cause instanceof Error ? error.cause : undefined;
  const code = errorCode(cause);
  const rootCode = errorCode(root);
  return Object.freeze({
    errorName: error?.name ?? typeof cause,
    errorMessage: error?.message ?? 'UNKNOWN_ERROR',
    ...(error?.stack === undefined ? {} : { errorStack: stack(error.stack) }),
    ...(code === undefined ? {} : { errorCode: code }),
    ...(root === undefined ? {} : { rootError: { name: root.name, message: root.message, ...(rootCode === undefined ? {} : { errorCode: rootCode }), ...(root.stack === undefined ? {} : { stack: stack(root.stack) }) } }),
  });
}

function errorCode(cause: unknown): string | undefined {
  return cause !== null && typeof cause === 'object' && 'code' in cause ? String(cause.code) : undefined;
}

function stack(value: string): string {
  return value.split('\n').slice(0, 8).join('\n');
}
