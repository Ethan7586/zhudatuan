export interface ConsumerIdentityEntry {
  readonly application: string;
}

export function resolveConsumerIdentityEntry(search: string): ConsumerIdentityEntry | null {
  const params = new URLSearchParams(search);
  if (params.get('target') !== 'storefront') return null;
  const application = params.get('application')?.trim() ?? '';
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(application)) return null;
  return Object.freeze({ application });
}

export function isHongtaiConsoleEntry(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get('target') === 'console-hbbtzn' || params.get('client') === 'console-hbbtzn';
}
