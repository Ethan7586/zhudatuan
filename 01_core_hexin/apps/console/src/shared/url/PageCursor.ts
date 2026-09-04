export function pageCursor(search: URLSearchParams, cursor: string | undefined): URLSearchParams {
  const next = new URLSearchParams(search);
  if (cursor !== undefined) next.set('cursor', cursor);
  return next;
}
