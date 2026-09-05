export const ZHUDATUAN_STOREFRONT_APPLICATION = 'zhudatuan-storefront';
export const HONGTAI_STOREFRONT_APPLICATION = 'zdt-l1-verify';

function currentStorefrontHostname(): string {
  if (typeof window !== 'undefined') return window.location.hostname;
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
