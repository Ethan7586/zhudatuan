export function retentionUntil(days: number, now = new Date()): string {
  if (!Number.isSafeInteger(days) || days < 1 || !Number.isFinite(now.getTime())) throw new Error('RETENTION_INVALID');
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}
