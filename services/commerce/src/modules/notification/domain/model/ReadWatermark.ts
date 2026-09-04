import { createHash } from 'node:crypto';

export function notificationDevice(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512) throw new Error('NOTIFICATION_DEVICE_INVALID');
  return createHash('sha256').update(normalized).digest('hex');
}
