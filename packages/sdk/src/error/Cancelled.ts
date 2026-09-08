export function isCancelled(cause: unknown): boolean {
  return cause instanceof DOMException && cause.name === 'AbortError';
}
