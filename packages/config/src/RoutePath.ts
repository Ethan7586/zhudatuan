export function relativeRoutePath(path: string, base: string, route: string): string {
  const prefix = `${base}/`;
  if (base === '/' || !path.startsWith(prefix)) throw new Error(`ROUTE_BASE_INVALID:${route}`);
  return path.slice(prefix.length);
}
