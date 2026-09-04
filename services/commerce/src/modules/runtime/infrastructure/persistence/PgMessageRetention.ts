export function retentionBoundary(value: Date): Date {
  if (!Number.isFinite(value.getTime())) throw new Error('MESSAGE_RETENTION_INVALID');
  return value;
}
