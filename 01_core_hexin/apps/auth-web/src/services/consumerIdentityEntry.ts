export interface ConsumerIdentityEntry {
  readonly application: string;
  readonly target: 'storefront' | 'storefront-hbbtzn';
}

const APPLICATION_TARGETS = Object.freeze({
  'zhudatuan-storefront': 'storefront',
  'zdt-l1-verify': 'storefront-hbbtzn',
} as const);

export function resolveConsumerIdentityEntry(search: string): ConsumerIdentityEntry | null {
  const params = new URLSearchParams(search);
  const application = params.get('application')?.trim() ?? '';
  if (!(application in APPLICATION_TARGETS)) return null;
  const target = APPLICATION_TARGETS[application as keyof typeof APPLICATION_TARGETS];
  if (params.get('target') !== target) return null;
  return Object.freeze({ application, target });
}

export function isHongtaiConsoleEntry(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('target') === 'console-hbbtzn' || params.get('client') === 'console-hbbtzn';
}
