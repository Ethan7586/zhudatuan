export interface NavigationAccessRequirement {
  readonly capability: string;
  readonly permission: string;
}

const requirement = (capability: string, permission: string): NavigationAccessRequirement =>
  Object.freeze({ capability, permission });

export const navigationAccessRequirements: Readonly<Record<string, readonly NavigationAccessRequirement[]>> = Object.freeze({
  cockpit: Object.freeze([requirement('reporting.dashboard.read', 'reporting.dashboard.read')]),
  control: Object.freeze([requirement('runtime.health.dependency', 'runtime.health.read')]),
  applications: Object.freeze([requirement('experience.applications.read', 'experience.application.read')]),
  products: Object.freeze([requirement('catalog.listings.read', 'catalog.listing.read')]),
  orders: Object.freeze([requirement('order.orders.read', 'order.read')]),
  referralsettings: Object.freeze([requirement('referral.settings.read', 'referral.settings.read')]),
  referralproducts: Object.freeze([requirement('referral.products.read', 'referral.products.read')]),
  referralreview: Object.freeze([requirement('referral.members.read', 'referral.members.read')]),
  referralbindings: Object.freeze([requirement('referral.bindings.read', 'referral.bindings.read')]),
  referralwithdrawals: Object.freeze([requirement('referral.commissions.read', 'referral.commissions.read')]),
  referralpromotion: Object.freeze([requirement('referral.commissions.read', 'referral.commissions.read')]),
  channels: Object.freeze([requirement('channel.connections.read', 'channel.connection.read')]),
  vouchers: Object.freeze([
    requirement('voucher.cardlibraries.read', 'voucher.cardlibrary.read'),
    requirement('voucher.programs.read', 'voucher.program.read'),
    requirement('voucher.reserves.read', 'voucher.reserve.read'),
    requirement('voucher.batches.read', 'voucher.batch.read'),
  ]),
  finance: Object.freeze([
    requirement('finance.overview.read', 'finance.overview.read'),
    requirement('finance.reconciliations.read', 'finance.reconciliation.read'),
  ]),
  access: Object.freeze([requirement('access.center.read', 'access.center.read')]),
  qualification: Object.freeze([requirement('qualification.center.read', 'qualification.read')]),
});

export function canAccessNavigationTarget(
  key: string | undefined,
  permissions: readonly string[],
  capabilities: readonly string[],
): boolean {
  if (key === undefined) return true;
  const requirements = navigationAccessRequirements[key];
  if (requirements === undefined) return true;
  const permissionSet = new Set(permissions);
  const capabilitySet = new Set(capabilities);
  return requirements.every(({ capability, permission }) => capabilitySet.has(capability) && permissionSet.has(permission));
}
