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

const NODE_ENTRIES = Object.freeze({
  l0: Object.freeze({
    consumer: Object.freeze({ application: 'zhudatuan-storefront', target: 'storefront' }),
    operator: Object.freeze({ target: 'console', client: 'console', adminOrigin: 'https://console.zhudatuan.com' }),
  }),
  l1: Object.freeze({
    consumer: Object.freeze({ application: 'zdt-l1-verify', target: 'storefront-hbbtzn' }),
    operator: Object.freeze({ target: 'console-hbbtzn', client: 'console-hbbtzn', adminOrigin: 'https://console.hbbtzn.com' }),
  }),
} as const);

type IdentityNode = keyof typeof NODE_ENTRIES;

function identityNode(hostname: string): IdentityNode | 'local' | null {
  const normalizedHost = hostname.trim().toLowerCase();
  if (normalizedHost === 'accounts.zhudatuan.com') return 'l0';
  if (normalizedHost === 'accounts.hbbtzn.com') return 'l1';
  if (normalizedHost === 'localhost' || normalizedHost === '127.0.0.1') return 'local';
  return null;
}

export function resolveConsumerIdentityEntry(search: string): ConsumerIdentityEntry | null {
  const params = new URLSearchParams(search);
  const application = params.get('application')?.trim() ?? '';
  if (!(application in APPLICATION_TARGETS)) return null;
  const target = APPLICATION_TARGETS[application as keyof typeof APPLICATION_TARGETS];
  if (params.get('target') !== target) return null;
  return Object.freeze({ application, target });
}

export function resolveIdentityEntry(search: string, hostname: string): IdentityEntry | null {
  const node = identityNode(hostname);
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

export function recoverLocalIdentitySearch(search: string, hostname: string): string | null {
  const node = identityNode(hostname);
  if (node === null || node === 'local' || resolveIdentityEntry(search, hostname) !== null) return null;

  const params = new URLSearchParams(search);
  const target = params.get('target')?.trim() ?? '';
  const client = params.get('client')?.trim() ?? '';
  const application = params.get('application')?.trim() ?? '';
  const consumerIntent = target === 'storefront'
    || target === 'storefront-hbbtzn'
    || application in APPLICATION_TARGETS;

  if (consumerIntent) {
    const local = NODE_ENTRIES[node].consumer;
    params.set('target', local.target);
    params.set('surface', 'web');
    params.set('application', local.application);
    params.delete('client');
    params.delete('admin_origin');
    return `?${params.toString()}`;
  }

  const operatorIntent = target === 'console'
    || target === 'console-hbbtzn'
    || client === 'console'
    || client === 'console-hbbtzn';
  if (!operatorIntent) return null;

  const local = NODE_ENTRIES[node].operator;
  params.set('target', local.target);
  params.set('client', local.client);
  params.set('admin_origin', local.adminOrigin);
  params.delete('application');
  params.delete('surface');
  return `?${params.toString()}`;
}

export function isHongtaiConsoleEntry(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('target') === 'console-hbbtzn' || params.get('client') === 'console-hbbtzn';
}
