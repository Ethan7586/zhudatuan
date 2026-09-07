export const ZHUDATUAN_STOREFRONT_APPLICATION = 'zhudatuan-storefront';
export const HONGTAI_STOREFRONT_APPLICATION = 'zdt-l1-verify';
export type StorefrontAuthTarget = 'storefront' | 'storefront-hbbtzn';

export interface StorefrontPresentationIdentity {
  readonly mallName: string;
  readonly brandName: string;
}

function currentStorefrontHostname(): string {
  if (typeof window !== 'undefined' && window.location?.hostname) return window.location.hostname;
  return process.env.NEXT_PUBLIC_STOREFRONT_HOSTNAME || 'zhudatuan.com';
}

export function resolveStorefrontApplication(
  hostname: string = currentStorefrontHostname(),
  configured: string | undefined = process.env.NEXT_PUBLIC_STOREFRONT_APPLICATION,
): string {
  const explicit = configured?.trim();
  if (explicit) return explicit;
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  return normalized === 'hbbtzn.com' || normalized.endsWith('.hbbtzn.com')
    ? HONGTAI_STOREFRONT_APPLICATION
    : ZHUDATUAN_STOREFRONT_APPLICATION;
}

export function resolveStorefrontAuthTarget(application: string = resolveStorefrontApplication()): StorefrontAuthTarget {
  if (application === ZHUDATUAN_STOREFRONT_APPLICATION) return 'storefront';
  if (application === HONGTAI_STOREFRONT_APPLICATION) return 'storefront-hbbtzn';
  throw new Error('商城身份节点无效');
}

/** Keep the host's visible identity stable while the member scope hydrates. */
export function resolveStorefrontPresentationIdentity(
  hostname: string = currentStorefrontHostname(),
  configured: string | undefined = process.env.NEXT_PUBLIC_STOREFRONT_APPLICATION,
): StorefrontPresentationIdentity {
  return resolveStorefrontApplication(hostname, configured) === HONGTAI_STOREFRONT_APPLICATION
    ? { mallName: '宏泰甄选', brandName: '宏泰甄选' }
    : { mallName: '筑大团商城', brandName: '筑大团' };
}
