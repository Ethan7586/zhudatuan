export interface ConsumerIdentityEntry {
  readonly application: string;
  readonly target: 'storefront' | 'storefront-hbbtzn';
}

export type IdentityEntry =
  | Readonly<{ kind: 'consumer'; application: string; target: ConsumerIdentityEntry['target'] }>
  | Readonly<{ kind: 'operator'; target: 'console' | 'console-hbbtzn' }>;

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

export function resolveIdentityEntry(search: string, hostname: string): IdentityEntry | null {
  const normalizedHost = hostname.trim().toLowerCase();
  const node = normalizedHost === 'accounts.zhudatuan.com'
    ? 'l0'
    : normalizedHost === 'accounts.hbbtzn.com'
      ? 'l1'
      : normalizedHost === 'localhost' || normalizedHost === '127.0.0.1'
        ? 'local'
        : null;
  if (node === null) return null;

  const consumer = resolveConsumerIdentityEntry(search);
  if (consumer !== null) {
    const consumerNode = consumer.target === 'storefront-hbbtzn' ? 'l1' : 'l0';
    if (node !== 'local' && node !== consumerNode) return null;
    return Object.freeze({ kind: 'consumer', ...consumer });
  }

  const params = new URLSearchParams(search);
  const target = params.get('target')?.trim() ?? '';
  const client = params.get('client')?.trim() ?? '';
  const application = params.get('application')?.trim() ?? '';
  if (target.startsWith('storefront') || application in APPLICATION_TARGETS) return null;

  const operatorTarget = node === 'l1' || (node === 'local' && isHongtaiConsoleEntry(search))
    ? 'console-hbbtzn'
    : 'console';
  if ((target && target !== operatorTarget) || (client && client !== operatorTarget)) return null;
  return Object.freeze({ kind: 'operator', target: operatorTarget });
}

export function isHongtaiConsoleEntry(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('target') === 'console-hbbtzn' || params.get('client') === 'console-hbbtzn';
}
