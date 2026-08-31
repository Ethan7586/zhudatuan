export const DELIVERY_CHANNEL_IDS = ['sms', 'email', 'wechat', 'inapp'] as const;

export type DeliveryChannelId = (typeof DELIVERY_CHANNEL_IDS)[number];
export type SecretRef = string & { readonly __secretRef: unique symbol };
export type SecretPurpose = 'cache' | 'database' | 'finance' | 'identity' | 'identityprovider' | 'invitation' | 'manifest' | 'navigation' | 'notification' | 'objectstore' | 'providerconfig' | 'quote' | 'session';

export interface DeliveryRequest {
  readonly recipient: string;
  readonly providerTemplate: string | null;
  readonly variables: Readonly<Record<string, string | number | boolean>>;
  readonly subject: string | null;
  readonly body: string;
  readonly idempotency: string;
}

export interface DeliveryReceipt {
  readonly provider: string;
  readonly externalId: string;
}

export interface DeliveryChannel {
  readonly id: DeliveryChannelId;
  send(request: DeliveryRequest): Promise<DeliveryReceipt>;
}

export interface SecretReader {
  resolve(reference: SecretRef): Promise<SecretMaterial>;
}

export interface SecretMaterial {
  readonly version: string;
  readonly expiresAt: Date | null;
  reveal(purpose: SecretPurpose): string;
}

export function secretRef(value: unknown): SecretRef {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(value)) {
    throw new Error('SECRET_REFERENCE_INVALID');
  }
  return value as SecretRef;
}
