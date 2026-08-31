// Generated shell from definitions/operations.yml. Do not edit.
import type { OperationId } from '@shop/contract';
import type { AccessContext } from '../security/AccessContext';
import type { Handler } from './Handler';

export const HANDLED_OPERATION_IDS = Object.freeze([
  'runtime.health.live',
  'runtime.health.ready',
  'runtime.health.startup',
  'runtime.health.dependency',
  'identity.sessions.create',
  'identity.tickets.exchange',
  'identity.session.read',
  'identity.session.delete',
  'identity.sessions.read',
  'identity.sessions.revoke',
  'identity.challenges.create',
  'identity.invitations.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.members.create',
  'identity.members.manage',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'identity.members.reset',
  'identity.password.change',
  'identity.password.verify',
  'identity.password.reset',
  'identity.mobile.challenge',
<<<<<<< HEAD
=======
  'identity.password.change',
  'identity.password.verify',
  'identity.password.reset',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'identity.mobile.manage',
  'identity.stepup.start',
  'identity.stepup.complete',
  'identity.wechat.session',
  'identity.wechat.bind',
  'organization.layers.read',
  'access.center.read',
  'access.roles.manage',
  'access.scopes.manage',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'access.ownership.read',
  'access.ownership.transfers.preview',
  'access.ownership.transfers.create',
  'access.ownership.transfers.accept.preview',
  'access.ownership.transfers.accept',
  'access.ownership.transfers.cancel',
  'access.ownership.transfers.cancel.preview',
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'capability.assignments.read',
  'capability.assignments.manage',
  'partner.partners.read',
  'partner.partners.manage',
  'organization.stores.read',
  'organization.stores.manage',
  'member.members.read',
  'member.profile.read',
  'member.addresses.read',
  'member.addresses.manage',
  'member.imports.create',
  'member.imports.read',
  'qualification.center.read',
  'qualification.decisions.preview',
  'qualification.policies.manage',
  'channel.distributors.create',
  'channel.distributors.read',
  'channel.distributors.update',
  'channel.distributors.disable',
  'channel.bindings.manage',
  'channel.quotas.manage',
  'catalog.pools.read',
  'catalog.pools.attach',
  'catalog.pools.detach',
  'catalog.pools.allocate',
  'catalog.products.create',
  'catalog.products.update',
  'catalog.products.archive',
  'catalog.listings.read',
  'catalog.listings.publish',
  'catalog.listings.unpublish',
  'catalog.listings.batch',
  'catalog.imports.create',
  'catalog.imports.read',
  'pricing.rules.create',
  'pricing.rules.publish',
  'pricing.offers.read',
  'inventory.availability.read',
  'inventory.imports.create',
  'inventory.imports.read',
  'marketing.campaigns.read',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'referral.settings.read',
  'referral.settings.manage',
  'referral.products.read',
  'referral.products.manage',
  'referral.members.read',
  'referral.members.apply',
  'referral.members.approve',
  'referral.members.disqualify',
  'referral.bindings.read',
  'referral.bindings.create',
  'referral.commissions.read',
  'referral.earnings.read',
  'referral.links.read',
  'referral.withdrawals.read',
  'referral.withdrawals.create',
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'reporting.dashboard.read',
  'reporting.sales.read',
  'reporting.products.read',
  'reporting.malls.read',
  'reporting.categories.read',
  'reporting.channels.read',
  'reporting.powderclass.read',
  'reporting.voucherconsumption.read',
  'reporting.exports.create',
  'reporting.exports.read',
  'experience.applications.create',
  'experience.published.read',
  'experience.applications.copy',
  'experience.applications.read',
  'experience.applications.update',
  'experience.versions.save',
  'experience.versions.validate',
  'experience.versions.publish',
  'experience.versions.restore',
  'cart.current.read',
  'cart.items.put',
  'cart.items.batch',
  'checkout.quote.create',
  'order.orders.create',
  'order.orders.read',
  'order.reminders.create',
  'order.orders.export',
  'order.aftersales.read',
  'order.aftersales.apply',
  'order.aftersales.approve',
  'order.aftersales.reject',
  'fulfillment.shipments.create',
  'fulfillment.tracking.read',
  'fulfillment.returns.receive',
  'fulfillment.returns.inspect',
  'payment.intents.create',
  'verification.challenges.issue',
  'verification.sessions.read',
  'verification.challenges.verify',
  'verification.history.read',
  'verification.devices.read',
  'verification.devices.manage',
  'payment.refunds.request',
  'payment.recoveries.read',
  'payment.recoveries.resolve',
  'payment.webhooks.wechat',
  'voucher.cardlibraries.read',
  'voucher.cardlibraries.create',
  'voucher.cardlibraries.allocate',
  'voucher.imports.read',
  'voucher.programs.read',
  'voucher.programs.manage',
  'voucher.reserves.read',
  'voucher.reserves.request',
  'voucher.reserves.decide',
  'voucher.batches.read',
  'voucher.batches.issue',
  'voucher.batches.retry',
  'voucher.status.batch',
  'voucher.statusbatches.read',
  'voucher.bindings.read',
  'voucher.bindings.manage',
  'voucher.redemptions.read',
  'voucher.history.read',
  'voucher.redemptions.reverse',
  'benefit.accounts.read',
  'benefit.ledgers.read',
  'benefit.plans.read',
  'benefit.plans.manage',
  'benefit.budgets.read',
  'benefit.budgets.manage',
  'benefit.grants.create',
  'benefit.grants.decide',
  'benefit.grants.read',
  'benefit.grants.control',
  'benefit.grants.revoke',
  'benefit.lots.read',
  'finance.overview.read',
  'finance.entries.read',
  'finance.statements.read',
  'finance.statements.export',
  'finance.reconciliations.manage',
  'finance.reconciliations.read',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'finance.reconciliationrepairs.read',
  'finance.reconciliationrepairs.preview',
  'finance.reconciliationrepairs.submit',
  'finance.reconciliationrepairs.decide',
  'finance.reconciliationrepairs.reverse',
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'finance.settlements.read',
  'finance.settlements.decide',
  'finance.settlements.adjust',
  'finance.withdrawals.read',
  'finance.withdrawals.create',
  'finance.withdrawals.decide',
  'finance.withdrawals.recover',
  'finance.holds.read',
  'finance.periods.read',
  'finance.periods.manage',
  'finance.backfills.read',
  'finance.backfills.decide',
  'finance.policies.manage',
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'finance.policies.preview',
  'finance.policies.read',
  'finance.audit.read',
  'invoice.profiles.manage',
  'invoice.profiles.read',
  'invoice.operatorprofiles.read',
<<<<<<< HEAD
=======
  'invoice.profiles.manage',
  'invoice.profiles.read',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  'invoice.requests.create',
  'invoice.requests.read',
  'invoice.requests.cancel',
  'invoice.requests.decide',
  'invoice.requests.red',
  'support.cases.create',
  'support.cases.read',
  'support.cases.update',
  'support.cases.close',
  'support.cases.reopen',
  'support.messages.send',
  'support.messages.read',
  'support.attachments.create',
  'support.assignments.manage',
  'support.agents.manage',
  'support.agents.read',
  'support.accounts.manage',
  'support.accounts.read',
  'support.rules.read',
  'support.rules.manage',
  'support.slas.read',
  'support.slas.manage',
  'support.history.read',
  'notification.notifications.read',
  'notification.preferences.read',
  'notification.preferences.manage',
  'notification.endpoints.manage',
  'notification.templates.manage',
  'notification.templates.read',
  'notification.announcements.read',
  'notification.announcements.manage',
  'risk.center.read',
  'risk.policies.manage',
  'risk.cases.review',
  'audit.records.read',
  'observability.clienterrors.create',
  'observability.clienterrors.read',
  'channel.connections.read',
  'channel.connections.create',
  'channel.connections.update',
  'channel.connections.test',
  'channel.connections.enable',
  'channel.connections.disable',
  'channel.webhooks.receive',
  'channel.syncruns.start',
  'channel.syncruns.read',
  'channel.syncruns.cancel',
  'channel.operations.read',
  'channel.operations.replay',
  'extension.installations.read',
] as const satisfies readonly OperationId[]);

export interface OperationInput {
  readonly path: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string | readonly string[]>>;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly rawBody: string;
  readonly deadline: number;
  readonly signal: AbortSignal;
<<<<<<< HEAD
<<<<<<< HEAD
  /** Server-derived target used for authorization and action-proof binding. */
  readonly resource?: string;
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  /** Server-derived target used for authorization and action-proof binding. */
  readonly resource?: string;
>>>>>>> 018b2a71 (chore(release): capture current production source)
  readonly idempotency?: string;
  readonly expectedVersion?: number;
}

export interface OperationRequest {
  readonly type: OperationId;
  readonly input: OperationInput;
  readonly access: AccessContext | null;
}

export interface OperationResult {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface OperationUsecase {
  invoke(request: OperationRequest): Promise<OperationResult>;
}

export class OperationHandler implements Handler<OperationRequest, OperationResult> {
  constructor(private readonly usecase: OperationUsecase) {}

  handle(request: OperationRequest): Promise<OperationResult> {
    return this.usecase.invoke(request);
  }
}
