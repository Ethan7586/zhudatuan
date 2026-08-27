export function withCursor(search: URLSearchParams, cursor: string): URLSearchParams {
  const next = new URLSearchParams(search);
  next.set('cursor', cursor);
  return next;
}
