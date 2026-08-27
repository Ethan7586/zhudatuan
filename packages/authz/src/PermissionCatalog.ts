import type { PermissionDefinition } from './Permission';
import { SCOPE_KINDS, type ScopeKind } from './ScopeKind';

const all = SCOPE_KINDS as readonly ScopeKind[];
const operator = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department', 'store', 'supplier', 'brand'] as const;
const scoped = ['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department'] as const;

const definition = (code: string, category: string, risk: PermissionDefinition['risk'] = 'low', scopes: readonly ScopeKind[] = scoped): PermissionDefinition =>
  Object.freeze({ code, category, risk, stepup: risk === 'critical', scopes });

export const PERMISSION_CATALOG = Object.freeze([
  definition('runtime.health.read', 'runtime', 'high', operator),
  definition('identity.session.read', 'identity', 'low', ['self']),
  definition('identity.session.manage', 'identity', 'elevated', ['self']),
  definition('identity.credential.manage', 'identity', 'critical', ['self']),
  definition('identity.mobile.manage', 'identity', 'high', ['self']),
  definition('identity.assurance.manage', 'identity', 'elevated', ['self']),
  definition('identity.invitation.manage', 'identity', 'high', operator),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  definition('identity.registration.reset', 'identity', 'high', operator),
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  definition('identity.registration.reset', 'identity', 'high', operator),
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  definition('organization.layer.read', 'organization'),
  definition('organization.layer.manage', 'organization', 'critical', ['platform']),
  definition('access.center.read', 'access', 'high', operator),
  definition('access.role.manage', 'access', 'critical', operator),
  definition('access.scope.manage', 'access', 'critical', operator),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  definition('access.ownership.read', 'access', 'high', ['self']),
  definition('access.ownership.transfer', 'access', 'critical', ['self']),
  definition('access.ownership.accept', 'access', 'critical', ['self']),
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  definition('access.ownership.read', 'access', 'high', ['self']),
  definition('access.ownership.transfer', 'access', 'critical', ['self']),
  definition('access.ownership.accept', 'access', 'critical', ['self']),
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  definition('capability.assignment.read', 'capability', 'high', operator),
  definition('capability.assignment.manage', 'capability', 'critical', operator),
  definition('partner.read', 'partner', 'low', operator),
  definition('partner.manage', 'partner', 'high', operator),
  definition('member.read', 'member', 'elevated', operator),
  definition('member.manage', 'member', 'high', operator),
  definition('member.import', 'member', 'high', operator),
  definition('member.profile.read', 'member', 'low', ['owner']),
  definition('member.address.read', 'member', 'low', ['owner']),
  definition('member.address.manage', 'member', 'high', ['owner']),
  definition('qualification.read', 'qualification', 'low', operator),
  definition('qualification.preview', 'qualification', 'high', operator),
  definition('qualification.manage', 'qualification', 'critical', operator),
  definition('channel.distributor.read', 'channel'),
  definition('channel.distributor.manage', 'channel', 'critical', ['platform']),
  definition('channel.binding.manage', 'channel', 'critical'),
  definition('channel.quota.manage', 'channel', 'critical'),
  definition('channel.connection.manage', 'channel', 'critical'),
  definition('channel.connection.read', 'channel', 'high'),
  definition('channel.sync.read', 'channel'),
  definition('channel.sync.manage', 'channel', 'high'),
  definition('channel.operation.read', 'channel', 'high'),
  definition('channel.operation.replay', 'channel', 'critical'),
  definition('catalog.pool.read', 'catalog'),
  definition('catalog.pool.manage', 'catalog', 'high'),
  definition('catalog.pool.allocate', 'catalog', 'critical'),
  definition('catalog.product.manage', 'catalog', 'high', operator),
  definition('catalog.listing.read', 'catalog', 'low', all),
  definition('catalog.listing.manage', 'catalog', 'high', operator),
  definition('catalog.import.manage', 'catalog', 'high', operator),
  definition('catalog.import.read', 'catalog', 'low', operator),
  definition('pricing.rule.manage', 'pricing', 'critical', operator),
  definition('pricing.offer.read', 'pricing', 'low', all),
  definition('inventory.read', 'inventory', 'low', all),
  definition('inventory.import.manage', 'inventory', 'high', operator),
  definition('inventory.import.read', 'inventory', 'low', operator),
  definition('marketing.read', 'marketing', 'low', all),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  definition('referral.settings.read', 'referral', 'elevated', ['mall']),
  definition('referral.settings.manage', 'referral', 'critical', ['mall']),
  definition('referral.products.read', 'referral', 'low', ['mall']),
  definition('referral.products.manage', 'referral', 'critical', ['mall']),
  definition('referral.members.read', 'referral', 'elevated', ['mall']),
  definition('referral.members.approve', 'referral', 'high', ['mall']),
  definition('referral.members.disqualify', 'referral', 'high', ['mall']),
  definition('referral.bindings.read', 'referral', 'elevated', ['mall']),
  definition('referral.commissions.read', 'referral', 'high', ['mall']),
  definition('referral.self.read', 'referral', 'low', ['owner']),
  definition('referral.self.manage', 'referral', 'high', ['owner']),
  definition('referral.withdrawals.create', 'referral', 'critical', ['owner']),
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  definition('reporting.dashboard.read', 'reporting'),
  definition('reporting.sales.read', 'reporting'),
  definition('reporting.product.read', 'reporting'),
  definition('reporting.mall.read', 'reporting'),
  definition('reporting.category.read', 'reporting'),
  definition('reporting.channel.read', 'reporting'),
  definition('reporting.powderclass.read', 'reporting'),
  definition('reporting.voucher.read', 'reporting'),
  definition('reporting.export.read', 'reporting', 'high'),
  definition('reporting.export.manage', 'reporting', 'critical'),
  definition('experience.application.read', 'experience'),
  definition('experience.application.manage', 'experience', 'high'),
  definition('experience.version.manage', 'experience', 'high'),
  definition('experience.version.publish', 'experience', 'critical'),
  definition('cart.read', 'cart', 'low', ['owner']),
  definition('cart.manage', 'cart', 'low', ['owner']),
  definition('checkout.create', 'checkout', 'elevated', ['owner']),
  definition('order.create', 'order', 'elevated', ['owner']),
  definition('order.read', 'order', 'low', all),
  definition('order.reminder.create', 'order', 'low', ['owner']),
  definition('order.export', 'order', 'critical'),
  definition('order.aftersale.read', 'order', 'low', all),
  definition('order.aftersale.apply', 'order', 'elevated', ['owner']),
  definition('order.aftersale.decide', 'order', 'critical', operator),
  definition('fulfillment.ship', 'fulfillment', 'high', operator),
  definition('fulfillment.return.manage', 'fulfillment', 'high', operator),
  definition('fulfillment.read', 'fulfillment', 'low', all),
  definition('payment.create', 'payment', 'high', ['owner']),
  definition('payment.refund', 'payment', 'critical', operator),
  definition('payment.recovery.read', 'payment', 'high', operator),
  definition('payment.recovery.manage', 'payment', 'critical', operator),
  definition('verification.issue', 'verification', 'high', ['store', 'owner']),
  definition('verification.verify', 'verification', 'high', ['store']),
  definition('voucher.cardlibrary.manage', 'voucher', 'critical'),
  definition('voucher.cardlibrary.allocate', 'voucher', 'critical'),
  definition('voucher.cardlibrary.read', 'voucher'),
  definition('voucher.program.manage', 'voucher', 'high'),
  definition('voucher.program.read', 'voucher'),
  definition('voucher.reserve.request', 'voucher', 'high'),
  definition('voucher.reserve.decide', 'voucher', 'critical'),
  definition('voucher.reserve.read', 'voucher', 'high'),
  definition('voucher.issue', 'voucher', 'critical'),
  definition('voucher.batch.read', 'voucher', 'high'),
  definition('voucher.status.manage', 'voucher', 'critical'),
  definition('voucher.binding.read', 'voucher', 'low', all),
  definition('voucher.binding.manage', 'voucher', 'high'),
  definition('voucher.history.read', 'voucher', 'high'),
  definition('voucher.redemption.read', 'voucher', 'high'),
  definition('voucher.redemption.reverse', 'voucher', 'critical'),
  definition('benefit.read', 'benefit', 'low', all),
  definition('benefit.grant', 'benefit', 'critical', operator),
  definition('benefit.grant.decide', 'benefit', 'critical', operator),
  definition('benefit.plan.read', 'benefit', 'low', operator),
  definition('benefit.plan.manage', 'benefit', 'high', operator),
  definition('benefit.budget.read', 'benefit', 'high', operator),
  definition('benefit.budget.manage', 'benefit', 'critical', operator),
  definition('benefit.grant.read', 'benefit', 'high', operator),
  definition('benefit.grant.control', 'benefit', 'critical', operator),
  definition('benefit.revoke', 'benefit', 'critical', operator),
  definition('benefit.lot.read', 'benefit', 'high', operator),
  definition('finance.overview.read', 'finance', 'elevated'),
  definition('finance.entry.read', 'finance', 'elevated'),
  definition('finance.statement.read', 'finance', 'elevated'),
  definition('finance.statement.export', 'finance', 'critical'),
  definition('finance.reconciliation.manage', 'finance', 'critical'),
  definition('finance.reconciliation.read', 'finance', 'elevated'),
  definition('finance.settlement.read', 'finance', 'elevated'),
  definition('finance.settlement.decide', 'finance', 'critical'),
  definition('finance.settlement.adjust', 'finance', 'critical'),
  definition('finance.withdrawal.read', 'finance', 'elevated'),
  definition('finance.withdrawal.create', 'finance', 'critical'),
  definition('finance.withdrawal.decide', 'finance', 'critical'),
  definition('finance.withdrawal.recover', 'finance', 'critical'),
  definition('finance.hold.read', 'finance', 'elevated'),
  definition('finance.period.read', 'finance', 'elevated'),
  definition('finance.period.manage', 'finance', 'critical'),
  definition('finance.backfill.read', 'finance', 'high'),
  definition('finance.backfill.decide', 'finance', 'critical'),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  definition('finance.policy.read', 'finance', 'elevated'),
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  definition('finance.policy.read', 'finance', 'elevated'),
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  definition('finance.policy.manage', 'finance', 'critical'),
  definition('invoice.profile.manage', 'invoice', 'high'),
  definition('invoice.profile.read', 'invoice', 'elevated', all),
  definition('invoice.request.create', 'invoice', 'high'),
  definition('invoice.request.read', 'invoice', 'elevated'),
  definition('invoice.request.cancel', 'invoice', 'high'),
  definition('invoice.request.decide', 'invoice', 'critical'),
  definition('invoice.request.red', 'invoice', 'critical'),
  definition('support.case.create', 'support', 'low', all),
  definition('support.case.read', 'support', 'elevated', all),
  definition('support.case.manage', 'support', 'high'),
  definition('support.message.send', 'support', 'elevated', all),
  definition('support.message.read', 'support', 'elevated', all),
  definition('support.assignment.manage', 'support', 'high'),
  definition('support.agent.read', 'support', 'high'),
  definition('support.agent.manage', 'support', 'high'),
  definition('support.account.read', 'support', 'high'),
  definition('support.account.manage', 'support', 'critical'),
  definition('support.rule.read', 'support', 'high'),
  definition('support.rule.manage', 'support', 'critical'),
  definition('support.sla.read', 'support', 'high'),
  definition('support.sla.manage', 'support', 'critical'),
  definition('support.history.read', 'support', 'high'),
  definition('notification.read', 'notification', 'low', all),
  definition('notification.preference.read', 'notification', 'low', ['owner']),
  definition('notification.preference.manage', 'notification', 'low', ['owner']),
  definition('notification.endpoint.manage', 'notification', 'elevated', ['owner']),
  definition('notification.template.read', 'notification', 'high', operator),
  definition('notification.template.manage', 'notification', 'critical', operator),
  definition('notification.announcement.read', 'notification', 'high', operator),
  definition('notification.announcement.manage', 'notification', 'critical', operator),
  definition('risk.read', 'risk', 'high', operator),
  definition('risk.manage', 'risk', 'critical', operator),
  definition('observability.clienterror.create', 'observability', 'low', ['owner']),
  definition('observability.clienterror.read', 'observability', 'high', operator),
  definition('audit.read', 'audit', 'high', operator),
  definition('extension.installation.read', 'extension', 'high', ['platform']),
] as const);

const byCode = new Map(PERMISSION_CATALOG.map((permission) => [permission.code, permission]));
if (byCode.size !== PERMISSION_CATALOG.length) throw new Error('PERMISSION_DUPLICATE');

export function permissionDefinition(code: string): PermissionDefinition {
  const permission = byCode.get(code);
  if (!permission) throw new Error('PERMISSION_UNKNOWN');
  return permission;
}
