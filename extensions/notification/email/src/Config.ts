import { secretRef, type SecretRef } from '@shop/contract';
import { isPrivateIpv4Host } from '@shop/config/server';

export interface EmailConfiguration {
  readonly endpoint: string;
  readonly provider: string;
  readonly sender: string;
  readonly credentialRef: SecretRef;
  readonly priority: number;
}

export function parseEmailConfiguration(value: unknown): EmailConfiguration {
  const source = record(value);
  const allowed = ['credentialRef', 'endpoint', 'priority', 'provider', 'sender'];
  if (Object.keys(source).some((key) => !allowed.includes(key))) throw new Error('EMAIL_CONFIGURATION_INVALID');
  const endpoint = text(source.endpoint, 8, 500);
  const provider = text(source.provider, 2, 64);
  const sender = text(source.sender, 3, 255);
  const priority = source.priority === undefined ? 20 : Number(source.priority);
  let endpointUrl: URL;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    throw new Error('EMAIL_CONFIGURATION_INVALID');
  }
  if (endpointUrl.protocol !== 'https:' || endpointUrl.username || endpointUrl.password || endpointUrl.search || endpointUrl.hash || endpointUrl.port ||
    endpointUrl.hostname === 'localhost' || endpointUrl.hostname.endsWith('.localhost') || isPrivateIpv4Host(endpointUrl.hostname) ||
    !/^[a-z][a-z0-9.-]{1,63}$/.test(provider) || !email(sender) || !Number.isSafeInteger(priority) || priority < 0 || priority > 1_000) {
    throw new Error('EMAIL_CONFIGURATION_INVALID');
  }
  return Object.freeze({ endpoint: endpointUrl.toString().replace(/\/$/, ''), provider, sender, credentialRef: secretRef(source.credentialRef), priority });
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('EMAIL_CONFIGURATION_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown, minimum: number, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.trim().length > maximum) throw new Error('EMAIL_CONFIGURATION_INVALID');
  return value.trim();
}
export function email(value: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,190}$/.test(value);
}
