export function errorCause(cause: unknown, fallbackCode: string): Error {
  return cause instanceof Error ? cause : new Error(fallbackCode, { cause });
}
