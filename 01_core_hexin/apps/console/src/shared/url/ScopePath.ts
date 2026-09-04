export function scopePath(scope: Readonly<{ kind: string; id: string }>, feature: string): string {
  return `/scopes/${encodeURIComponent(scope.kind)}/${encodeURIComponent(scope.id)}/${feature}`;
}
