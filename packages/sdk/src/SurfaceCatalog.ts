// Generated from config/clients.yml and definitions/operations.yml. Do not edit.
import type { ClientSurface, OperationId } from '@shop/contract';
import type { OperationExecutor } from './OperationDescriptor';
import { createCommerceClient, type CommerceClient } from './operations/CommerceClient';

export const SURFACE_CATALOG = Object.freeze([
  {
    "id": "auth",
    "title": "身份中心",
    "audience": "public",
    "target": null,
    "transport": "browser"
  },
  {
    "id": "console",
    "title": "运营控制台",
    "audience": "console",
    "target": "console",
    "transport": "browser"
  },
  {
    "id": "storefront",
    "title": "消费者商城",
    "audience": "storefront",
    "target": "storefront",
    "transport": "browser"
  },
  {
    "id": "miniapp",
    "title": "微信小程序",
    "audience": "storefront",
    "target": "miniapp",
    "transport": "wechat"
  },
  {
    "id": "store",
    "title": "门店工作台",
    "audience": "console",
    "target": "store",
    "transport": "browser"
  },
  {
    "id": "supplier",
    "title": "供应链后台",
    "audience": "console",
    "target": "supplier",
    "transport": "browser"
  }
].map((surface) => Object.freeze(surface)));
export const SURFACE_OPERATION_IDS = Object.freeze({
  "auth": [
    "identity.sessions.create",
    "identity.sessions.complete",
    "identity.tickets.exchange",
    "identity.session.read",
    "identity.session.delete",
    "identity.sessions.read",
    "identity.sessions.revoke",
    "identity.memberships.read",
    "identity.memberships.switch",
    "identity.challenges.create",
    "identity.mobile.challenges.create",
    "identity.invitations.resolve",
    "identity.enrollments.read",
    "identity.enrollments.complete",
    "identity.password.change",
    "identity.password.verify",
    "identity.password.reset",
    "identity.mobile.manage",
    "identity.stepup.start",
    "identity.stepup.complete",
    "identity.stepup.disable",
    "identity.bootstrap.read",
    "identity.providers.read",
    "identity.federations.start",
    "identity.federations.callback",
    "identity.federations.selection.read",
    "identity.federations.complete",
    "identity.links.read",
    "identity.links.create",
    "identity.links.revoke"
  ],
  "console": [
    "runtime.health.dependency",
    "runtime.jobs.read",
    "runtime.jobs.cancel",
    "runtime.uploads.create",
    "runtime.imports.create",
    "runtime.imports.read",
    "runtime.imports.confirm",
    "runtime.imports.retry",
    "runtime.exports.read",
    "runtime.exports.cancel",
    "identity.sessions.create",
    "identity.sessions.complete",
    "identity.tickets.exchange",
    "identity.session.read",
    "identity.session.delete",
    "identity.handovers.read",
    "identity.handovers.create",
    "identity.sessions.read",
    "identity.sessions.revoke",
    "identity.memberships.read",
    "identity.memberships.switch",
    "identity.challenges.create",
    "identity.mobile.challenges.create",
    "identity.invitations.resolve",
    "identity.invitations.read",
    "identity.invitations.create",
    "identity.invitations.revoke",
    "identity.enrollments.read",
    "identity.enrollments.complete",
    "identity.members.manage",
    "identity.password.change",
    "identity.password.verify",
    "identity.password.reset",
    "identity.mobile.manage",
    "identity.stepup.start",
    "identity.stepup.complete",
    "identity.stepup.disable",
    "organization.layers.read",
    "organization.malls.create",
    "organization.malls.read",
    "organization.malls.update",
    "access.center.read",
    "access.ownership.read",
    "access.ownership.transfers.preview",
    "access.ownership.transfers.create",
    "access.ownership.transfers.accept.preview",
    "access.ownership.transfers.accept",
    "access.ownership.transfers.cancel.preview",
    "access.ownership.transfers.cancel",
    "access.roles.manage",
    "access.overrides.manage",
    "access.scopes.manage",
    "capability.assignments.read",
    "capability.assignments.manage",
    "partner.partners.read",
    "partner.customers.create",
    "partner.customers.update",
    "partner.customers.enable",
    "partner.customers.disable",
    "partner.customers.get",
    "partner.customers.list",
    "partner.customeroptions.list",
    "partner.partners.manage",
    "organization.stores.read",
    "organization.stores.manage",
    "member.members.read",
    "member.profile.read",
    "member.imports.create",
    "member.imports.read",
    "qualification.center.read",
    "qualification.decisions.preview",
    "qualification.policies.manage",
    "qualification.qualifications.publish",
    "qualification.qualifications.revoke",
    "qualification.evidenceuploads.create",
    "channel.distributors.create",
    "channel.distributors.read",
    "channel.distributors.update",
    "channel.distributors.disable",
    "channel.bindings.manage",
    "channel.quotas.manage",
    "catalog.pools.read",
    "catalog.pools.attach",
    "catalog.pools.detach",
    "catalog.pools.allocate",
    "catalog.product.detail.read",
    "catalog.products.create",
    "catalog.products.update",
    "catalog.products.archive",
    "catalog.listings.read",
    "catalog.facets.read",
    "catalog.listings.publish",
    "catalog.listings.price.set",
    "catalog.listings.pool.set",
    "catalog.listings.unpublish",
    "catalog.listings.batch",
    "catalog.imports.create",
    "catalog.imports.read",
    "pricing.rules.create",
    "pricing.rules.publish",
    "pricing.offers.read",
    "inventory.availability.read",
    "inventory.adjustments.read",
    "inventory.adjustments.create",
    "inventory.imports.create",
    "inventory.imports.read",
    "marketing.campaigns.read",
    "marketing.campaigns.create",
    "marketing.campaigns.revise",
    "marketing.campaigns.publish",
    "marketing.campaigns.disable",
    "reporting.dashboard.read",
    "reporting.sales.read",
    "reporting.products.read",
    "reporting.malls.read",
    "reporting.categories.read",
    "reporting.channels.read",
    "reporting.voucherconsumption.read",
    "reporting.exports.create",
    "reporting.exports.read",
    "experience.applications.create",
    "experience.applications.copy",
    "experience.applications.detail.read",
    "experience.applications.read",
    "experience.applications.update",
    "experience.versions.save",
    "experience.versions.validate",
    "experience.versions.publish",
    "experience.versions.restore",
    "experience.published.read",
    "order.orders.cancel",
    "order.orders.read",
    "order.detail.read",
    "order.reminders.create",
    "order.orders.export",
    "order.imports.create",
    "order.imports.read",
    "order.aftersales.read",
    "order.aftersales.approve",
    "order.aftersales.reject",
    "fulfillment.workitems.read",
    "fulfillment.workitems.transition",
    "fulfillment.returns.read",
    "fulfillment.shipments.create",
    "fulfillment.returns.receive",
    "fulfillment.returns.inspect",
    "verification.challenges.issue",
    "verification.challenges.verify",
    "verification.history.read",
    "verification.devices.read",
    "verification.devices.manage",
    "payment.refunds.request",
    "payment.recoveries.read",
    "payment.recoveries.resolve",
    "voucher.products.create",
    "voucher.products.revise",
    "voucher.products.enable",
    "voucher.products.disable",
    "voucher.products.get",
    "voucher.products.list",
    "voucher.productoptions.list",
    "voucher.credentialpools.create",
    "voucher.credentials.generate",
    "voucher.credentials.import",
    "voucher.credentialpools.close",
    "voucher.credentialpools.get",
    "voucher.credentialpools.list",
    "voucher.credentials.list",
    "voucher.credentials.get",
    "voucher.credentialexports.create",
    "voucher.jobs.get",
    "voucher.stockrequests.create",
    "voucher.stockrequests.update",
    "voucher.stockrequests.submit",
    "voucher.stockrequests.cancel",
    "voucher.stockrequests.get",
    "voucher.stockrequests.list",
    "voucher.stockrequestoptions.list",
    "voucher.issueorders.create",
    "voucher.issueorders.update",
    "voucher.issueorders.submit",
    "voucher.issueorders.cancel",
    "voucher.issueorders.get",
    "voucher.issueorders.list",
    "voucher.issuebatches.retry",
    "voucher.issuebatches.get",
    "voucher.issueorderexports.create",
    "voucher.actionbatches.create",
    "voucher.actionbatches.get",
    "voucher.actionbatches.list",
    "voucher.actionbatches.retry",
    "voucher.actionexports.create",
    "voucher.search.read",
    "voucher.activations.secret",
    "voucher.activations.numbersecret",
    "voucher.vouchers.bind",
    "voucher.vouchers.unbind",
    "voucher.vouchers.get",
    "voucher.vouchers.getbynumber",
    "voucher.vouchers.timeline",
    "voucher.redemptions.quote",
    "voucher.tenderholds.create",
    "voucher.tenderholds.consume",
    "voucher.tenderholds.release",
    "voucher.redemptions.create",
    "voucher.refunds.create",
    "voucher.redemptions.get",
    "voucher.searchfacets.read",
    "voucher.searchsnapshots.create",
    "voucher.searchexports.create",
    "voucher.exports.get",
    "benefit.plans.read",
    "benefit.plans.manage",
    "benefit.budgets.read",
    "benefit.budgets.manage",
    "benefit.grants.create",
    "benefit.grants.decide",
    "benefit.grants.read",
    "benefit.grants.control",
    "benefit.grants.revoke",
    "benefit.lots.read",
    "finance.overview.read",
    "finance.facets.read",
    "finance.audit.read",
    "finance.entries.read",
    "finance.statementimports.create",
    "finance.statementimports.read",
    "finance.statements.read",
    "finance.statements.export",
    "finance.reconciliations.manage",
    "finance.reconciliations.read",
    "finance.settlements.read",
    "finance.settlements.decide",
    "finance.settlements.adjust",
    "finance.withdrawals.read",
    "finance.withdrawals.create",
    "finance.withdrawals.decide",
    "finance.withdrawals.recover",
    "finance.holds.read",
    "finance.periods.read",
    "finance.periods.manage",
    "finance.backfills.read",
    "finance.backfills.decide",
    "finance.policies.manage",
    "invoice.profiles.manage",
    "invoice.requests.read",
    "invoice.requests.cancel",
    "invoice.requests.decide",
    "invoice.requests.red",
    "support.cases.read",
    "support.cases.update",
    "support.cases.close",
    "support.cases.reopen",
    "support.messages.send",
    "support.messages.read",
    "support.attachments.create",
    "support.assignments.manage",
    "support.agents.manage",
    "support.agents.read",
    "support.accounts.manage",
    "support.accounts.read",
    "support.rules.read",
    "support.rules.manage",
    "support.slas.read",
    "support.slas.manage",
    "support.history.read",
    "support.events.read",
    "support.readstates.manage",
    "notification.templates.manage",
    "notification.templates.read",
    "notification.announcements.read",
    "notification.announcements.manage",
    "risk.center.read",
    "risk.policies.manage",
    "risk.cases.review",
    "audit.records.read",
    "observability.clienterrors.read",
    "observability.healthoverview.read",
    "observability.slo.read",
    "channel.connections.read",
    "channel.connections.create",
    "channel.connections.update",
    "channel.connections.test",
    "channel.connections.enable",
    "channel.connections.disable",
    "channel.syncruns.start",
    "channel.syncruns.read",
    "channel.syncruns.cancel",
    "channel.operations.read",
    "channel.operations.replay",
    "extension.installations.read",
    "navigation.tree.read",
    "navigation.catalog.read",
    "identity.bootstrap.read",
    "identity.providers.read",
    "identity.federations.start",
    "identity.federations.callback",
    "identity.federations.selection.read",
    "identity.federations.complete",
    "identity.links.read",
    "identity.links.create",
    "identity.links.revoke",
    "identity.providers.center.read",
    "identity.providers.manage",
    "identity.providers.test",
    "organization.directories.read",
    "organization.directories.manage",
    "organization.directories.sync",
    "organization.directories.syncruns.read",
    "referral.settings.read",
    "referral.settings.manage",
    "referral.products.read",
    "referral.products.manage",
    "referral.members.read",
    "referral.members.apply",
    "referral.members.approve",
    "referral.members.disqualify",
    "referral.bindings.read",
    "referral.bindings.create",
    "referral.commissions.read",
    "referral.earnings.read",
    "referral.links.read",
    "referral.withdrawals.read",
    "referral.withdrawals.create",
    "finance.policies.read",
    "finance.policies.preview",
    "finance.reconciliationrepairs.read",
    "finance.reconciliationrepairs.preview",
    "finance.reconciliationrepairs.submit",
    "finance.reconciliationrepairs.decide",
    "finance.reconciliationrepairs.reverse",
    "approval.templates.create",
    "approval.templates.revise",
    "approval.templates.enable",
    "approval.templates.disable",
    "approval.templates.get",
    "approval.templates.list",
    "approval.tasks.list",
    "approval.tasks.approve",
    "approval.tasks.reject",
    "approval.instances.get",
    "order.orders.receive"
  ],
  "storefront": [
    "identity.sessions.create",
    "identity.sessions.complete",
    "identity.tickets.exchange",
    "identity.session.read",
    "identity.session.delete",
    "identity.sessions.read",
    "identity.sessions.revoke",
    "identity.memberships.read",
    "identity.memberships.switch",
    "identity.challenges.create",
    "identity.mobile.challenges.create",
    "identity.invitations.resolve",
    "identity.enrollments.read",
    "identity.enrollments.complete",
    "identity.password.change",
    "identity.password.verify",
    "identity.password.reset",
    "identity.mobile.manage",
    "identity.stepup.start",
    "identity.stepup.complete",
    "identity.stepup.disable",
    "member.profile.read",
    "member.addresses.read",
    "member.addresses.manage",
    "member.favorites.read",
    "member.favorites.put",
    "pricing.offers.read",
    "inventory.availability.read",
    "experience.published.read",
    "cart.current.read",
    "cart.anonymous.merge",
    "cart.items.put",
    "cart.items.batch",
    "checkout.quote.create",
    "order.orders.create",
    "order.orders.cancel",
    "order.orders.read",
    "order.detail.read",
    "order.reminders.create",
    "order.aftersales.read",
    "order.aftersaleattachments.create",
    "order.aftersales.apply",
    "fulfillment.tracking.read",
    "payment.intents.create",
    "payment.intents.read",
    "verification.sessions.read",
    "voucher.search.read",
    "voucher.activations.secret",
    "voucher.activations.numbersecret",
    "voucher.vouchers.get",
    "voucher.vouchers.timeline",
    "voucher.redemptions.get",
    "benefit.accounts.read",
    "benefit.ledgers.read",
    "finance.invoices.read",
    "finance.invoices.download",
    "invoice.profiles.read",
    "invoice.requests.create",
    "support.cases.create",
    "support.cases.read",
    "support.messages.send",
    "support.messages.read",
    "support.attachments.create",
    "support.events.read",
    "support.readstates.manage",
    "notification.notifications.read",
    "notification.notifications.ack",
    "notification.preferences.read",
    "notification.preferences.manage",
    "notification.endpoints.manage",
    "observability.clienterrors.create",
    "identity.bootstrap.read",
    "identity.providers.read",
    "identity.federations.start",
    "identity.federations.callback",
    "identity.federations.selection.read",
    "identity.federations.complete",
    "identity.links.read",
    "identity.links.create",
    "identity.links.revoke",
    "referral.members.apply",
    "referral.bindings.read",
    "referral.bindings.create",
    "referral.earnings.read",
    "referral.links.read",
    "referral.withdrawals.read",
    "referral.withdrawals.create",
    "order.orders.receive",
    "checkout.quotes.current.read",
    "storefront.bootstrap.read",
    "storefront.catalog.read"
  ],
  "miniapp": [
    "identity.sessions.create",
    "identity.sessions.complete",
    "identity.tickets.exchange",
    "identity.session.read",
    "identity.session.delete",
    "identity.sessions.read",
    "identity.sessions.revoke",
    "identity.memberships.read",
    "identity.memberships.switch",
    "identity.challenges.create",
    "identity.mobile.challenges.create",
    "identity.invitations.resolve",
    "identity.enrollments.read",
    "identity.enrollments.complete",
    "identity.password.change",
    "identity.password.verify",
    "identity.password.reset",
    "identity.mobile.manage",
    "identity.stepup.start",
    "identity.stepup.complete",
    "identity.stepup.disable",
    "member.profile.read",
    "member.addresses.read",
    "member.addresses.manage",
    "member.favorites.read",
    "member.favorites.put",
    "pricing.offers.read",
    "inventory.availability.read",
    "experience.published.read",
    "cart.current.read",
    "cart.anonymous.merge",
    "cart.items.put",
    "cart.items.batch",
    "checkout.quote.create",
    "order.orders.create",
    "order.orders.cancel",
    "order.orders.read",
    "order.detail.read",
    "order.reminders.create",
    "order.aftersales.read",
    "order.aftersaleattachments.create",
    "order.aftersales.apply",
    "fulfillment.tracking.read",
    "payment.intents.create",
    "payment.intents.read",
    "verification.sessions.read",
    "voucher.search.read",
    "voucher.activations.secret",
    "voucher.activations.numbersecret",
    "voucher.vouchers.get",
    "voucher.vouchers.timeline",
    "voucher.redemptions.get",
    "benefit.accounts.read",
    "benefit.ledgers.read",
    "finance.invoices.read",
    "finance.invoices.download",
    "invoice.profiles.read",
    "invoice.requests.create",
    "support.cases.create",
    "support.cases.read",
    "support.messages.send",
    "support.messages.read",
    "support.attachments.create",
    "support.events.read",
    "support.readstates.manage",
    "notification.notifications.read",
    "notification.notifications.ack",
    "notification.preferences.read",
    "notification.preferences.manage",
    "notification.endpoints.manage",
    "observability.clienterrors.create",
    "identity.bootstrap.read",
    "identity.providers.read",
    "identity.federations.start",
    "identity.federations.callback",
    "identity.federations.selection.read",
    "identity.federations.complete",
    "identity.links.read",
    "identity.links.create",
    "identity.links.revoke",
    "referral.members.apply",
    "referral.bindings.read",
    "referral.bindings.create",
    "referral.earnings.read",
    "referral.links.read",
    "referral.withdrawals.read",
    "referral.withdrawals.create",
    "order.orders.receive",
    "checkout.quotes.current.read",
    "storefront.bootstrap.read",
    "storefront.catalog.read"
  ],
  "store": [
    "identity.sessions.create",
    "identity.sessions.complete",
    "identity.tickets.exchange",
    "identity.session.read",
    "identity.session.delete",
    "identity.handovers.read",
    "identity.handovers.create",
    "identity.sessions.read",
    "identity.sessions.revoke",
    "identity.memberships.read",
    "identity.memberships.switch",
    "identity.challenges.create",
    "identity.mobile.challenges.create",
    "identity.invitations.resolve",
    "identity.enrollments.read",
    "identity.enrollments.complete",
    "identity.password.change",
    "identity.password.verify",
    "identity.password.reset",
    "identity.mobile.manage",
    "identity.stepup.start",
    "identity.stepup.complete",
    "identity.stepup.disable",
    "organization.layers.read",
    "capability.assignments.read",
    "organization.stores.read",
    "member.profile.read",
    "pricing.offers.read",
    "inventory.availability.read",
    "inventory.adjustments.read",
    "inventory.adjustments.create",
    "experience.published.read",
    "order.orders.cancel",
    "order.orders.read",
    "order.detail.read",
    "order.reminders.create",
    "order.aftersales.read",
    "fulfillment.workitems.read",
    "fulfillment.workitems.transition",
    "fulfillment.returns.read",
    "fulfillment.shipments.create",
    "fulfillment.returns.receive",
    "fulfillment.returns.inspect",
    "verification.challenges.issue",
    "verification.challenges.verify",
    "verification.history.read",
    "verification.devices.read",
    "verification.devices.manage",
    "payment.refunds.request",
    "payment.recoveries.read",
    "payment.recoveries.resolve",
    "voucher.search.read",
    "voucher.activations.secret",
    "voucher.activations.numbersecret",
    "voucher.vouchers.bind",
    "voucher.vouchers.unbind",
    "voucher.vouchers.get",
    "voucher.vouchers.getbynumber",
    "voucher.vouchers.timeline",
    "voucher.redemptions.quote",
    "voucher.tenderholds.create",
    "voucher.tenderholds.consume",
    "voucher.tenderholds.release",
    "voucher.redemptions.create",
    "voucher.refunds.create",
    "voucher.redemptions.get",
    "support.cases.read",
    "support.messages.send",
    "support.messages.read",
    "support.attachments.create",
    "support.events.read",
    "support.readstates.manage",
    "navigation.tree.read",
    "navigation.catalog.read",
    "identity.bootstrap.read",
    "identity.providers.read",
    "identity.federations.start",
    "identity.federations.callback",
    "identity.federations.selection.read",
    "identity.federations.complete",
    "identity.links.read",
    "identity.links.create",
    "identity.links.revoke",
    "referral.members.apply",
    "referral.bindings.read",
    "referral.bindings.create",
    "referral.earnings.read",
    "referral.links.read",
    "referral.withdrawals.read",
    "referral.withdrawals.create",
    "order.orders.receive"
  ],
  "supplier": [
    "runtime.uploads.create",
    "identity.sessions.create",
    "identity.sessions.complete",
    "identity.tickets.exchange",
    "identity.session.read",
    "identity.session.delete",
    "identity.sessions.read",
    "identity.sessions.revoke",
    "identity.memberships.read",
    "identity.memberships.switch",
    "identity.challenges.create",
    "identity.mobile.challenges.create",
    "identity.invitations.resolve",
    "identity.enrollments.read",
    "identity.enrollments.complete",
    "identity.password.change",
    "identity.password.verify",
    "identity.password.reset",
    "identity.mobile.manage",
    "identity.stepup.start",
    "identity.stepup.complete",
    "identity.stepup.disable",
    "organization.layers.read",
    "capability.assignments.read",
    "partner.partners.read",
    "member.profile.read",
    "catalog.pools.read",
    "catalog.product.detail.read",
    "catalog.products.create",
    "catalog.products.update",
    "catalog.listings.read",
    "catalog.facets.read",
    "catalog.listings.price.set",
    "catalog.imports.create",
    "catalog.imports.read",
    "pricing.offers.read",
    "inventory.availability.read",
    "inventory.imports.create",
    "inventory.imports.read",
    "experience.published.read",
    "order.orders.cancel",
    "order.orders.read",
    "order.detail.read",
    "order.reminders.create",
    "order.aftersales.read",
    "fulfillment.workitems.read",
    "fulfillment.workitems.transition",
    "fulfillment.returns.read",
    "fulfillment.shipments.create",
    "fulfillment.returns.receive",
    "fulfillment.returns.inspect",
    "voucher.search.read",
    "voucher.activations.secret",
    "voucher.activations.numbersecret",
    "voucher.vouchers.get",
    "voucher.vouchers.timeline",
    "voucher.redemptions.get",
    "finance.overview.read",
    "finance.entries.read",
    "finance.statements.read",
    "finance.statements.export",
    "finance.reconciliations.read",
    "finance.settlements.read",
    "invoice.requests.read",
    "support.cases.read",
    "support.messages.send",
    "support.messages.read",
    "support.attachments.create",
    "support.events.read",
    "support.readstates.manage",
    "channel.connections.read",
    "channel.connections.test",
    "channel.syncruns.read",
    "channel.operations.read",
    "navigation.tree.read",
    "navigation.catalog.read",
    "identity.bootstrap.read",
    "identity.providers.read",
    "identity.federations.start",
    "identity.federations.callback",
    "identity.federations.selection.read",
    "identity.federations.complete",
    "identity.links.read",
    "identity.links.create",
    "identity.links.revoke",
    "referral.members.apply",
    "referral.bindings.read",
    "referral.bindings.create",
    "referral.earnings.read",
    "referral.links.read",
    "referral.withdrawals.read",
    "referral.withdrawals.create",
    "order.orders.receive"
  ]
} as const satisfies Readonly<Record<ClientSurface, readonly OperationId[]>>);
const SURFACE_METHODS = Object.freeze({
  "auth": [
    {
      "domain": "identity",
      "method": "sessionsCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsComplete"
    },
    {
      "domain": "identity",
      "method": "ticketsExchange"
    },
    {
      "domain": "identity",
      "method": "sessionRead"
    },
    {
      "domain": "identity",
      "method": "sessionDelete"
    },
    {
      "domain": "identity",
      "method": "sessionsRead"
    },
    {
      "domain": "identity",
      "method": "sessionsRevoke"
    },
    {
      "domain": "identity",
      "method": "membershipsRead"
    },
    {
      "domain": "identity",
      "method": "membershipsSwitch"
    },
    {
      "domain": "identity",
      "method": "challengesCreate"
    },
    {
      "domain": "identity",
      "method": "mobileChallengesCreate"
    },
    {
      "domain": "identity",
      "method": "invitationsResolve"
    },
    {
      "domain": "identity",
      "method": "enrollmentsRead"
    },
    {
      "domain": "identity",
      "method": "enrollmentsComplete"
    },
    {
      "domain": "identity",
      "method": "passwordChange"
    },
    {
      "domain": "identity",
      "method": "passwordVerify"
    },
    {
      "domain": "identity",
      "method": "passwordReset"
    },
    {
      "domain": "identity",
      "method": "mobileManage"
    },
    {
      "domain": "identity",
      "method": "stepupStart"
    },
    {
      "domain": "identity",
      "method": "stepupComplete"
    },
    {
      "domain": "identity",
      "method": "stepupDisable"
    },
    {
      "domain": "identity",
      "method": "bootstrapRead"
    },
    {
      "domain": "identity",
      "method": "providersRead"
    },
    {
      "domain": "identity",
      "method": "federationsStart"
    },
    {
      "domain": "identity",
      "method": "federationsCallback"
    },
    {
      "domain": "identity",
      "method": "federationsSelectionRead"
    },
    {
      "domain": "identity",
      "method": "federationsComplete"
    },
    {
      "domain": "identity",
      "method": "linksRead"
    },
    {
      "domain": "identity",
      "method": "linksCreate"
    },
    {
      "domain": "identity",
      "method": "linksRevoke"
    }
  ],
  "console": [
    {
      "domain": "runtime",
      "method": "healthDependency"
    },
    {
      "domain": "runtime",
      "method": "jobsRead"
    },
    {
      "domain": "runtime",
      "method": "jobsCancel"
    },
    {
      "domain": "runtime",
      "method": "uploadsCreate"
    },
    {
      "domain": "runtime",
      "method": "importsCreate"
    },
    {
      "domain": "runtime",
      "method": "importsRead"
    },
    {
      "domain": "runtime",
      "method": "importsConfirm"
    },
    {
      "domain": "runtime",
      "method": "importsRetry"
    },
    {
      "domain": "runtime",
      "method": "exportsRead"
    },
    {
      "domain": "runtime",
      "method": "exportsCancel"
    },
    {
      "domain": "identity",
      "method": "sessionsCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsComplete"
    },
    {
      "domain": "identity",
      "method": "ticketsExchange"
    },
    {
      "domain": "identity",
      "method": "sessionRead"
    },
    {
      "domain": "identity",
      "method": "sessionDelete"
    },
    {
      "domain": "identity",
      "method": "handoversRead"
    },
    {
      "domain": "identity",
      "method": "handoversCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsRead"
    },
    {
      "domain": "identity",
      "method": "sessionsRevoke"
    },
    {
      "domain": "identity",
      "method": "membershipsRead"
    },
    {
      "domain": "identity",
      "method": "membershipsSwitch"
    },
    {
      "domain": "identity",
      "method": "challengesCreate"
    },
    {
      "domain": "identity",
      "method": "mobileChallengesCreate"
    },
    {
      "domain": "identity",
      "method": "invitationsResolve"
    },
    {
      "domain": "identity",
      "method": "invitationsRead"
    },
    {
      "domain": "identity",
      "method": "invitationsCreate"
    },
    {
      "domain": "identity",
      "method": "invitationsRevoke"
    },
    {
      "domain": "identity",
      "method": "enrollmentsRead"
    },
    {
      "domain": "identity",
      "method": "enrollmentsComplete"
    },
    {
      "domain": "identity",
      "method": "membersManage"
    },
    {
      "domain": "identity",
      "method": "passwordChange"
    },
    {
      "domain": "identity",
      "method": "passwordVerify"
    },
    {
      "domain": "identity",
      "method": "passwordReset"
    },
    {
      "domain": "identity",
      "method": "mobileManage"
    },
    {
      "domain": "identity",
      "method": "stepupStart"
    },
    {
      "domain": "identity",
      "method": "stepupComplete"
    },
    {
      "domain": "identity",
      "method": "stepupDisable"
    },
    {
      "domain": "organization",
      "method": "layersRead"
    },
    {
      "domain": "organization",
      "method": "mallsCreate"
    },
    {
      "domain": "organization",
      "method": "mallsRead"
    },
    {
      "domain": "organization",
      "method": "mallsUpdate"
    },
    {
      "domain": "access",
      "method": "centerRead"
    },
    {
      "domain": "access",
      "method": "ownershipRead"
    },
    {
      "domain": "access",
      "method": "ownershipTransfersPreview"
    },
    {
      "domain": "access",
      "method": "ownershipTransfersCreate"
    },
    {
      "domain": "access",
      "method": "ownershipTransfersAcceptPreview"
    },
    {
      "domain": "access",
      "method": "ownershipTransfersAccept"
    },
    {
      "domain": "access",
      "method": "ownershipTransfersCancelPreview"
    },
    {
      "domain": "access",
      "method": "ownershipTransfersCancel"
    },
    {
      "domain": "access",
      "method": "rolesManage"
    },
    {
      "domain": "access",
      "method": "overridesManage"
    },
    {
      "domain": "access",
      "method": "scopesManage"
    },
    {
      "domain": "capability",
      "method": "assignmentsRead"
    },
    {
      "domain": "capability",
      "method": "assignmentsManage"
    },
    {
      "domain": "partner",
      "method": "partnersRead"
    },
    {
      "domain": "partner",
      "method": "customersCreate"
    },
    {
      "domain": "partner",
      "method": "customersUpdate"
    },
    {
      "domain": "partner",
      "method": "customersEnable"
    },
    {
      "domain": "partner",
      "method": "customersDisable"
    },
    {
      "domain": "partner",
      "method": "customersGet"
    },
    {
      "domain": "partner",
      "method": "customersList"
    },
    {
      "domain": "partner",
      "method": "customeroptionsList"
    },
    {
      "domain": "partner",
      "method": "partnersManage"
    },
    {
      "domain": "organization",
      "method": "storesRead"
    },
    {
      "domain": "organization",
      "method": "storesManage"
    },
    {
      "domain": "member",
      "method": "membersRead"
    },
    {
      "domain": "member",
      "method": "profileRead"
    },
    {
      "domain": "member",
      "method": "importsCreate"
    },
    {
      "domain": "member",
      "method": "importsRead"
    },
    {
      "domain": "qualification",
      "method": "centerRead"
    },
    {
      "domain": "qualification",
      "method": "decisionsPreview"
    },
    {
      "domain": "qualification",
      "method": "policiesManage"
    },
    {
      "domain": "qualification",
      "method": "qualificationsPublish"
    },
    {
      "domain": "qualification",
      "method": "qualificationsRevoke"
    },
    {
      "domain": "qualification",
      "method": "evidenceuploadsCreate"
    },
    {
      "domain": "channel",
      "method": "distributorsCreate"
    },
    {
      "domain": "channel",
      "method": "distributorsRead"
    },
    {
      "domain": "channel",
      "method": "distributorsUpdate"
    },
    {
      "domain": "channel",
      "method": "distributorsDisable"
    },
    {
      "domain": "channel",
      "method": "bindingsManage"
    },
    {
      "domain": "channel",
      "method": "quotasManage"
    },
    {
      "domain": "catalog",
      "method": "poolsRead"
    },
    {
      "domain": "catalog",
      "method": "poolsAttach"
    },
    {
      "domain": "catalog",
      "method": "poolsDetach"
    },
    {
      "domain": "catalog",
      "method": "poolsAllocate"
    },
    {
      "domain": "catalog",
      "method": "productDetailRead"
    },
    {
      "domain": "catalog",
      "method": "productsCreate"
    },
    {
      "domain": "catalog",
      "method": "productsUpdate"
    },
    {
      "domain": "catalog",
      "method": "productsArchive"
    },
    {
      "domain": "catalog",
      "method": "listingsRead"
    },
    {
      "domain": "catalog",
      "method": "facetsRead"
    },
    {
      "domain": "catalog",
      "method": "listingsPublish"
    },
    {
      "domain": "catalog",
      "method": "listingsPriceSet"
    },
    {
      "domain": "catalog",
      "method": "listingsPoolSet"
    },
    {
      "domain": "catalog",
      "method": "listingsUnpublish"
    },
    {
      "domain": "catalog",
      "method": "listingsBatch"
    },
    {
      "domain": "catalog",
      "method": "importsCreate"
    },
    {
      "domain": "catalog",
      "method": "importsRead"
    },
    {
      "domain": "pricing",
      "method": "rulesCreate"
    },
    {
      "domain": "pricing",
      "method": "rulesPublish"
    },
    {
      "domain": "pricing",
      "method": "offersRead"
    },
    {
      "domain": "inventory",
      "method": "availabilityRead"
    },
    {
      "domain": "inventory",
      "method": "adjustmentsRead"
    },
    {
      "domain": "inventory",
      "method": "adjustmentsCreate"
    },
    {
      "domain": "inventory",
      "method": "importsCreate"
    },
    {
      "domain": "inventory",
      "method": "importsRead"
    },
    {
      "domain": "marketing",
      "method": "campaignsRead"
    },
    {
      "domain": "marketing",
      "method": "campaignsCreate"
    },
    {
      "domain": "marketing",
      "method": "campaignsRevise"
    },
    {
      "domain": "marketing",
      "method": "campaignsPublish"
    },
    {
      "domain": "marketing",
      "method": "campaignsDisable"
    },
    {
      "domain": "reporting",
      "method": "dashboardRead"
    },
    {
      "domain": "reporting",
      "method": "salesRead"
    },
    {
      "domain": "reporting",
      "method": "productsRead"
    },
    {
      "domain": "reporting",
      "method": "mallsRead"
    },
    {
      "domain": "reporting",
      "method": "categoriesRead"
    },
    {
      "domain": "reporting",
      "method": "channelsRead"
    },
    {
      "domain": "reporting",
      "method": "voucherconsumptionRead"
    },
    {
      "domain": "reporting",
      "method": "exportsCreate"
    },
    {
      "domain": "reporting",
      "method": "exportsRead"
    },
    {
      "domain": "experience",
      "method": "applicationsCreate"
    },
    {
      "domain": "experience",
      "method": "applicationsCopy"
    },
    {
      "domain": "experience",
      "method": "applicationsDetailRead"
    },
    {
      "domain": "experience",
      "method": "applicationsRead"
    },
    {
      "domain": "experience",
      "method": "applicationsUpdate"
    },
    {
      "domain": "experience",
      "method": "versionsSave"
    },
    {
      "domain": "experience",
      "method": "versionsValidate"
    },
    {
      "domain": "experience",
      "method": "versionsPublish"
    },
    {
      "domain": "experience",
      "method": "versionsRestore"
    },
    {
      "domain": "experience",
      "method": "publishedRead"
    },
    {
      "domain": "order",
      "method": "ordersCancel"
    },
    {
      "domain": "order",
      "method": "ordersRead"
    },
    {
      "domain": "order",
      "method": "detailRead"
    },
    {
      "domain": "order",
      "method": "remindersCreate"
    },
    {
      "domain": "order",
      "method": "ordersExport"
    },
    {
      "domain": "order",
      "method": "importsCreate"
    },
    {
      "domain": "order",
      "method": "importsRead"
    },
    {
      "domain": "order",
      "method": "aftersalesRead"
    },
    {
      "domain": "order",
      "method": "aftersalesApprove"
    },
    {
      "domain": "order",
      "method": "aftersalesReject"
    },
    {
      "domain": "fulfillment",
      "method": "workitemsRead"
    },
    {
      "domain": "fulfillment",
      "method": "workitemsTransition"
    },
    {
      "domain": "fulfillment",
      "method": "returnsRead"
    },
    {
      "domain": "fulfillment",
      "method": "shipmentsCreate"
    },
    {
      "domain": "fulfillment",
      "method": "returnsReceive"
    },
    {
      "domain": "fulfillment",
      "method": "returnsInspect"
    },
    {
      "domain": "verification",
      "method": "challengesIssue"
    },
    {
      "domain": "verification",
      "method": "challengesVerify"
    },
    {
      "domain": "verification",
      "method": "historyRead"
    },
    {
      "domain": "verification",
      "method": "devicesRead"
    },
    {
      "domain": "verification",
      "method": "devicesManage"
    },
    {
      "domain": "payment",
      "method": "refundsRequest"
    },
    {
      "domain": "payment",
      "method": "recoveriesRead"
    },
    {
      "domain": "payment",
      "method": "recoveriesResolve"
    },
    {
      "domain": "voucher",
      "method": "productsCreate"
    },
    {
      "domain": "voucher",
      "method": "productsRevise"
    },
    {
      "domain": "voucher",
      "method": "productsEnable"
    },
    {
      "domain": "voucher",
      "method": "productsDisable"
    },
    {
      "domain": "voucher",
      "method": "productsGet"
    },
    {
      "domain": "voucher",
      "method": "productsList"
    },
    {
      "domain": "voucher",
      "method": "productoptionsList"
    },
    {
      "domain": "voucher",
      "method": "credentialpoolsCreate"
    },
    {
      "domain": "voucher",
      "method": "credentialsGenerate"
    },
    {
      "domain": "voucher",
      "method": "credentialsImport"
    },
    {
      "domain": "voucher",
      "method": "credentialpoolsClose"
    },
    {
      "domain": "voucher",
      "method": "credentialpoolsGet"
    },
    {
      "domain": "voucher",
      "method": "credentialpoolsList"
    },
    {
      "domain": "voucher",
      "method": "credentialsList"
    },
    {
      "domain": "voucher",
      "method": "credentialsGet"
    },
    {
      "domain": "voucher",
      "method": "credentialexportsCreate"
    },
    {
      "domain": "voucher",
      "method": "jobsGet"
    },
    {
      "domain": "voucher",
      "method": "stockrequestsCreate"
    },
    {
      "domain": "voucher",
      "method": "stockrequestsUpdate"
    },
    {
      "domain": "voucher",
      "method": "stockrequestsSubmit"
    },
    {
      "domain": "voucher",
      "method": "stockrequestsCancel"
    },
    {
      "domain": "voucher",
      "method": "stockrequestsGet"
    },
    {
      "domain": "voucher",
      "method": "stockrequestsList"
    },
    {
      "domain": "voucher",
      "method": "stockrequestoptionsList"
    },
    {
      "domain": "voucher",
      "method": "issueordersCreate"
    },
    {
      "domain": "voucher",
      "method": "issueordersUpdate"
    },
    {
      "domain": "voucher",
      "method": "issueordersSubmit"
    },
    {
      "domain": "voucher",
      "method": "issueordersCancel"
    },
    {
      "domain": "voucher",
      "method": "issueordersGet"
    },
    {
      "domain": "voucher",
      "method": "issueordersList"
    },
    {
      "domain": "voucher",
      "method": "issuebatchesRetry"
    },
    {
      "domain": "voucher",
      "method": "issuebatchesGet"
    },
    {
      "domain": "voucher",
      "method": "issueorderexportsCreate"
    },
    {
      "domain": "voucher",
      "method": "actionbatchesCreate"
    },
    {
      "domain": "voucher",
      "method": "actionbatchesGet"
    },
    {
      "domain": "voucher",
      "method": "actionbatchesList"
    },
    {
      "domain": "voucher",
      "method": "actionbatchesRetry"
    },
    {
      "domain": "voucher",
      "method": "actionexportsCreate"
    },
    {
      "domain": "voucher",
      "method": "searchRead"
    },
    {
      "domain": "voucher",
      "method": "activationsSecret"
    },
    {
      "domain": "voucher",
      "method": "activationsNumbersecret"
    },
    {
      "domain": "voucher",
      "method": "vouchersBind"
    },
    {
      "domain": "voucher",
      "method": "vouchersUnbind"
    },
    {
      "domain": "voucher",
      "method": "vouchersGet"
    },
    {
      "domain": "voucher",
      "method": "vouchersGetbynumber"
    },
    {
      "domain": "voucher",
      "method": "vouchersTimeline"
    },
    {
      "domain": "voucher",
      "method": "redemptionsQuote"
    },
    {
      "domain": "voucher",
      "method": "tenderholdsCreate"
    },
    {
      "domain": "voucher",
      "method": "tenderholdsConsume"
    },
    {
      "domain": "voucher",
      "method": "tenderholdsRelease"
    },
    {
      "domain": "voucher",
      "method": "redemptionsCreate"
    },
    {
      "domain": "voucher",
      "method": "refundsCreate"
    },
    {
      "domain": "voucher",
      "method": "redemptionsGet"
    },
    {
      "domain": "voucher",
      "method": "searchfacetsRead"
    },
    {
      "domain": "voucher",
      "method": "searchsnapshotsCreate"
    },
    {
      "domain": "voucher",
      "method": "searchexportsCreate"
    },
    {
      "domain": "voucher",
      "method": "exportsGet"
    },
    {
      "domain": "benefit",
      "method": "plansRead"
    },
    {
      "domain": "benefit",
      "method": "plansManage"
    },
    {
      "domain": "benefit",
      "method": "budgetsRead"
    },
    {
      "domain": "benefit",
      "method": "budgetsManage"
    },
    {
      "domain": "benefit",
      "method": "grantsCreate"
    },
    {
      "domain": "benefit",
      "method": "grantsDecide"
    },
    {
      "domain": "benefit",
      "method": "grantsRead"
    },
    {
      "domain": "benefit",
      "method": "grantsControl"
    },
    {
      "domain": "benefit",
      "method": "grantsRevoke"
    },
    {
      "domain": "benefit",
      "method": "lotsRead"
    },
    {
      "domain": "finance",
      "method": "overviewRead"
    },
    {
      "domain": "finance",
      "method": "facetsRead"
    },
    {
      "domain": "finance",
      "method": "auditRead"
    },
    {
      "domain": "finance",
      "method": "entriesRead"
    },
    {
      "domain": "finance",
      "method": "statementimportsCreate"
    },
    {
      "domain": "finance",
      "method": "statementimportsRead"
    },
    {
      "domain": "finance",
      "method": "statementsRead"
    },
    {
      "domain": "finance",
      "method": "statementsExport"
    },
    {
      "domain": "finance",
      "method": "reconciliationsManage"
    },
    {
      "domain": "finance",
      "method": "reconciliationsRead"
    },
    {
      "domain": "finance",
      "method": "settlementsRead"
    },
    {
      "domain": "finance",
      "method": "settlementsDecide"
    },
    {
      "domain": "finance",
      "method": "settlementsAdjust"
    },
    {
      "domain": "finance",
      "method": "withdrawalsRead"
    },
    {
      "domain": "finance",
      "method": "withdrawalsCreate"
    },
    {
      "domain": "finance",
      "method": "withdrawalsDecide"
    },
    {
      "domain": "finance",
      "method": "withdrawalsRecover"
    },
    {
      "domain": "finance",
      "method": "holdsRead"
    },
    {
      "domain": "finance",
      "method": "periodsRead"
    },
    {
      "domain": "finance",
      "method": "periodsManage"
    },
    {
      "domain": "finance",
      "method": "backfillsRead"
    },
    {
      "domain": "finance",
      "method": "backfillsDecide"
    },
    {
      "domain": "finance",
      "method": "policiesManage"
    },
    {
      "domain": "invoice",
      "method": "profilesManage"
    },
    {
      "domain": "invoice",
      "method": "requestsRead"
    },
    {
      "domain": "invoice",
      "method": "requestsCancel"
    },
    {
      "domain": "invoice",
      "method": "requestsDecide"
    },
    {
      "domain": "invoice",
      "method": "requestsRed"
    },
    {
      "domain": "support",
      "method": "casesRead"
    },
    {
      "domain": "support",
      "method": "casesUpdate"
    },
    {
      "domain": "support",
      "method": "casesClose"
    },
    {
      "domain": "support",
      "method": "casesReopen"
    },
    {
      "domain": "support",
      "method": "messagesSend"
    },
    {
      "domain": "support",
      "method": "messagesRead"
    },
    {
      "domain": "support",
      "method": "attachmentsCreate"
    },
    {
      "domain": "support",
      "method": "assignmentsManage"
    },
    {
      "domain": "support",
      "method": "agentsManage"
    },
    {
      "domain": "support",
      "method": "agentsRead"
    },
    {
      "domain": "support",
      "method": "accountsManage"
    },
    {
      "domain": "support",
      "method": "accountsRead"
    },
    {
      "domain": "support",
      "method": "rulesRead"
    },
    {
      "domain": "support",
      "method": "rulesManage"
    },
    {
      "domain": "support",
      "method": "slasRead"
    },
    {
      "domain": "support",
      "method": "slasManage"
    },
    {
      "domain": "support",
      "method": "historyRead"
    },
    {
      "domain": "support",
      "method": "eventsRead"
    },
    {
      "domain": "support",
      "method": "readstatesManage"
    },
    {
      "domain": "notification",
      "method": "templatesManage"
    },
    {
      "domain": "notification",
      "method": "templatesRead"
    },
    {
      "domain": "notification",
      "method": "announcementsRead"
    },
    {
      "domain": "notification",
      "method": "announcementsManage"
    },
    {
      "domain": "risk",
      "method": "centerRead"
    },
    {
      "domain": "risk",
      "method": "policiesManage"
    },
    {
      "domain": "risk",
      "method": "casesReview"
    },
    {
      "domain": "audit",
      "method": "recordsRead"
    },
    {
      "domain": "observability",
      "method": "clienterrorsRead"
    },
    {
      "domain": "observability",
      "method": "healthoverviewRead"
    },
    {
      "domain": "observability",
      "method": "sloRead"
    },
    {
      "domain": "channel",
      "method": "connectionsRead"
    },
    {
      "domain": "channel",
      "method": "connectionsCreate"
    },
    {
      "domain": "channel",
      "method": "connectionsUpdate"
    },
    {
      "domain": "channel",
      "method": "connectionsTest"
    },
    {
      "domain": "channel",
      "method": "connectionsEnable"
    },
    {
      "domain": "channel",
      "method": "connectionsDisable"
    },
    {
      "domain": "channel",
      "method": "syncrunsStart"
    },
    {
      "domain": "channel",
      "method": "syncrunsRead"
    },
    {
      "domain": "channel",
      "method": "syncrunsCancel"
    },
    {
      "domain": "channel",
      "method": "operationsRead"
    },
    {
      "domain": "channel",
      "method": "operationsReplay"
    },
    {
      "domain": "extension",
      "method": "installationsRead"
    },
    {
      "domain": "navigation",
      "method": "treeRead"
    },
    {
      "domain": "navigation",
      "method": "catalogRead"
    },
    {
      "domain": "identity",
      "method": "bootstrapRead"
    },
    {
      "domain": "identity",
      "method": "providersRead"
    },
    {
      "domain": "identity",
      "method": "federationsStart"
    },
    {
      "domain": "identity",
      "method": "federationsCallback"
    },
    {
      "domain": "identity",
      "method": "federationsSelectionRead"
    },
    {
      "domain": "identity",
      "method": "federationsComplete"
    },
    {
      "domain": "identity",
      "method": "linksRead"
    },
    {
      "domain": "identity",
      "method": "linksCreate"
    },
    {
      "domain": "identity",
      "method": "linksRevoke"
    },
    {
      "domain": "identity",
      "method": "providersCenterRead"
    },
    {
      "domain": "identity",
      "method": "providersManage"
    },
    {
      "domain": "identity",
      "method": "providersTest"
    },
    {
      "domain": "organization",
      "method": "directoriesRead"
    },
    {
      "domain": "organization",
      "method": "directoriesManage"
    },
    {
      "domain": "organization",
      "method": "directoriesSync"
    },
    {
      "domain": "organization",
      "method": "directoriesSyncrunsRead"
    },
    {
      "domain": "referral",
      "method": "settingsRead"
    },
    {
      "domain": "referral",
      "method": "settingsManage"
    },
    {
      "domain": "referral",
      "method": "productsRead"
    },
    {
      "domain": "referral",
      "method": "productsManage"
    },
    {
      "domain": "referral",
      "method": "membersRead"
    },
    {
      "domain": "referral",
      "method": "membersApply"
    },
    {
      "domain": "referral",
      "method": "membersApprove"
    },
    {
      "domain": "referral",
      "method": "membersDisqualify"
    },
    {
      "domain": "referral",
      "method": "bindingsRead"
    },
    {
      "domain": "referral",
      "method": "bindingsCreate"
    },
    {
      "domain": "referral",
      "method": "commissionsRead"
    },
    {
      "domain": "referral",
      "method": "earningsRead"
    },
    {
      "domain": "referral",
      "method": "linksRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsCreate"
    },
    {
      "domain": "finance",
      "method": "policiesRead"
    },
    {
      "domain": "finance",
      "method": "policiesPreview"
    },
    {
      "domain": "finance",
      "method": "reconciliationrepairsRead"
    },
    {
      "domain": "finance",
      "method": "reconciliationrepairsPreview"
    },
    {
      "domain": "finance",
      "method": "reconciliationrepairsSubmit"
    },
    {
      "domain": "finance",
      "method": "reconciliationrepairsDecide"
    },
    {
      "domain": "finance",
      "method": "reconciliationrepairsReverse"
    },
    {
      "domain": "approval",
      "method": "templatesCreate"
    },
    {
      "domain": "approval",
      "method": "templatesRevise"
    },
    {
      "domain": "approval",
      "method": "templatesEnable"
    },
    {
      "domain": "approval",
      "method": "templatesDisable"
    },
    {
      "domain": "approval",
      "method": "templatesGet"
    },
    {
      "domain": "approval",
      "method": "templatesList"
    },
    {
      "domain": "approval",
      "method": "tasksList"
    },
    {
      "domain": "approval",
      "method": "tasksApprove"
    },
    {
      "domain": "approval",
      "method": "tasksReject"
    },
    {
      "domain": "approval",
      "method": "instancesGet"
    },
    {
      "domain": "order",
      "method": "ordersReceive"
    }
  ],
  "storefront": [
    {
      "domain": "identity",
      "method": "sessionsCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsComplete"
    },
    {
      "domain": "identity",
      "method": "ticketsExchange"
    },
    {
      "domain": "identity",
      "method": "sessionRead"
    },
    {
      "domain": "identity",
      "method": "sessionDelete"
    },
    {
      "domain": "identity",
      "method": "sessionsRead"
    },
    {
      "domain": "identity",
      "method": "sessionsRevoke"
    },
    {
      "domain": "identity",
      "method": "membershipsRead"
    },
    {
      "domain": "identity",
      "method": "membershipsSwitch"
    },
    {
      "domain": "identity",
      "method": "challengesCreate"
    },
    {
      "domain": "identity",
      "method": "mobileChallengesCreate"
    },
    {
      "domain": "identity",
      "method": "invitationsResolve"
    },
    {
      "domain": "identity",
      "method": "enrollmentsRead"
    },
    {
      "domain": "identity",
      "method": "enrollmentsComplete"
    },
    {
      "domain": "identity",
      "method": "passwordChange"
    },
    {
      "domain": "identity",
      "method": "passwordVerify"
    },
    {
      "domain": "identity",
      "method": "passwordReset"
    },
    {
      "domain": "identity",
      "method": "mobileManage"
    },
    {
      "domain": "identity",
      "method": "stepupStart"
    },
    {
      "domain": "identity",
      "method": "stepupComplete"
    },
    {
      "domain": "identity",
      "method": "stepupDisable"
    },
    {
      "domain": "member",
      "method": "profileRead"
    },
    {
      "domain": "member",
      "method": "addressesRead"
    },
    {
      "domain": "member",
      "method": "addressesManage"
    },
    {
      "domain": "member",
      "method": "favoritesRead"
    },
    {
      "domain": "member",
      "method": "favoritesPut"
    },
    {
      "domain": "pricing",
      "method": "offersRead"
    },
    {
      "domain": "inventory",
      "method": "availabilityRead"
    },
    {
      "domain": "experience",
      "method": "publishedRead"
    },
    {
      "domain": "cart",
      "method": "currentRead"
    },
    {
      "domain": "cart",
      "method": "anonymousMerge"
    },
    {
      "domain": "cart",
      "method": "itemsPut"
    },
    {
      "domain": "cart",
      "method": "itemsBatch"
    },
    {
      "domain": "checkout",
      "method": "quoteCreate"
    },
    {
      "domain": "order",
      "method": "ordersCreate"
    },
    {
      "domain": "order",
      "method": "ordersCancel"
    },
    {
      "domain": "order",
      "method": "ordersRead"
    },
    {
      "domain": "order",
      "method": "detailRead"
    },
    {
      "domain": "order",
      "method": "remindersCreate"
    },
    {
      "domain": "order",
      "method": "aftersalesRead"
    },
    {
      "domain": "order",
      "method": "aftersaleattachmentsCreate"
    },
    {
      "domain": "order",
      "method": "aftersalesApply"
    },
    {
      "domain": "fulfillment",
      "method": "trackingRead"
    },
    {
      "domain": "payment",
      "method": "intentsCreate"
    },
    {
      "domain": "payment",
      "method": "intentsRead"
    },
    {
      "domain": "verification",
      "method": "sessionsRead"
    },
    {
      "domain": "voucher",
      "method": "searchRead"
    },
    {
      "domain": "voucher",
      "method": "activationsSecret"
    },
    {
      "domain": "voucher",
      "method": "activationsNumbersecret"
    },
    {
      "domain": "voucher",
      "method": "vouchersGet"
    },
    {
      "domain": "voucher",
      "method": "vouchersTimeline"
    },
    {
      "domain": "voucher",
      "method": "redemptionsGet"
    },
    {
      "domain": "benefit",
      "method": "accountsRead"
    },
    {
      "domain": "benefit",
      "method": "ledgersRead"
    },
    {
      "domain": "finance",
      "method": "invoicesRead"
    },
    {
      "domain": "finance",
      "method": "invoicesDownload"
    },
    {
      "domain": "invoice",
      "method": "profilesRead"
    },
    {
      "domain": "invoice",
      "method": "requestsCreate"
    },
    {
      "domain": "support",
      "method": "casesCreate"
    },
    {
      "domain": "support",
      "method": "casesRead"
    },
    {
      "domain": "support",
      "method": "messagesSend"
    },
    {
      "domain": "support",
      "method": "messagesRead"
    },
    {
      "domain": "support",
      "method": "attachmentsCreate"
    },
    {
      "domain": "support",
      "method": "eventsRead"
    },
    {
      "domain": "support",
      "method": "readstatesManage"
    },
    {
      "domain": "notification",
      "method": "notificationsRead"
    },
    {
      "domain": "notification",
      "method": "notificationsAck"
    },
    {
      "domain": "notification",
      "method": "preferencesRead"
    },
    {
      "domain": "notification",
      "method": "preferencesManage"
    },
    {
      "domain": "notification",
      "method": "endpointsManage"
    },
    {
      "domain": "observability",
      "method": "clienterrorsCreate"
    },
    {
      "domain": "identity",
      "method": "bootstrapRead"
    },
    {
      "domain": "identity",
      "method": "providersRead"
    },
    {
      "domain": "identity",
      "method": "federationsStart"
    },
    {
      "domain": "identity",
      "method": "federationsCallback"
    },
    {
      "domain": "identity",
      "method": "federationsSelectionRead"
    },
    {
      "domain": "identity",
      "method": "federationsComplete"
    },
    {
      "domain": "identity",
      "method": "linksRead"
    },
    {
      "domain": "identity",
      "method": "linksCreate"
    },
    {
      "domain": "identity",
      "method": "linksRevoke"
    },
    {
      "domain": "referral",
      "method": "membersApply"
    },
    {
      "domain": "referral",
      "method": "bindingsRead"
    },
    {
      "domain": "referral",
      "method": "bindingsCreate"
    },
    {
      "domain": "referral",
      "method": "earningsRead"
    },
    {
      "domain": "referral",
      "method": "linksRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsCreate"
    },
    {
      "domain": "order",
      "method": "ordersReceive"
    },
    {
      "domain": "checkout",
      "method": "quotesCurrentRead"
    },
    {
      "domain": "storefront",
      "method": "bootstrapRead"
    },
    {
      "domain": "storefront",
      "method": "catalogRead"
    }
  ],
  "miniapp": [
    {
      "domain": "identity",
      "method": "sessionsCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsComplete"
    },
    {
      "domain": "identity",
      "method": "ticketsExchange"
    },
    {
      "domain": "identity",
      "method": "sessionRead"
    },
    {
      "domain": "identity",
      "method": "sessionDelete"
    },
    {
      "domain": "identity",
      "method": "sessionsRead"
    },
    {
      "domain": "identity",
      "method": "sessionsRevoke"
    },
    {
      "domain": "identity",
      "method": "membershipsRead"
    },
    {
      "domain": "identity",
      "method": "membershipsSwitch"
    },
    {
      "domain": "identity",
      "method": "challengesCreate"
    },
    {
      "domain": "identity",
      "method": "mobileChallengesCreate"
    },
    {
      "domain": "identity",
      "method": "invitationsResolve"
    },
    {
      "domain": "identity",
      "method": "enrollmentsRead"
    },
    {
      "domain": "identity",
      "method": "enrollmentsComplete"
    },
    {
      "domain": "identity",
      "method": "passwordChange"
    },
    {
      "domain": "identity",
      "method": "passwordVerify"
    },
    {
      "domain": "identity",
      "method": "passwordReset"
    },
    {
      "domain": "identity",
      "method": "mobileManage"
    },
    {
      "domain": "identity",
      "method": "stepupStart"
    },
    {
      "domain": "identity",
      "method": "stepupComplete"
    },
    {
      "domain": "identity",
      "method": "stepupDisable"
    },
    {
      "domain": "member",
      "method": "profileRead"
    },
    {
      "domain": "member",
      "method": "addressesRead"
    },
    {
      "domain": "member",
      "method": "addressesManage"
    },
    {
      "domain": "member",
      "method": "favoritesRead"
    },
    {
      "domain": "member",
      "method": "favoritesPut"
    },
    {
      "domain": "pricing",
      "method": "offersRead"
    },
    {
      "domain": "inventory",
      "method": "availabilityRead"
    },
    {
      "domain": "experience",
      "method": "publishedRead"
    },
    {
      "domain": "cart",
      "method": "currentRead"
    },
    {
      "domain": "cart",
      "method": "anonymousMerge"
    },
    {
      "domain": "cart",
      "method": "itemsPut"
    },
    {
      "domain": "cart",
      "method": "itemsBatch"
    },
    {
      "domain": "checkout",
      "method": "quoteCreate"
    },
    {
      "domain": "order",
      "method": "ordersCreate"
    },
    {
      "domain": "order",
      "method": "ordersCancel"
    },
    {
      "domain": "order",
      "method": "ordersRead"
    },
    {
      "domain": "order",
      "method": "detailRead"
    },
    {
      "domain": "order",
      "method": "remindersCreate"
    },
    {
      "domain": "order",
      "method": "aftersalesRead"
    },
    {
      "domain": "order",
      "method": "aftersaleattachmentsCreate"
    },
    {
      "domain": "order",
      "method": "aftersalesApply"
    },
    {
      "domain": "fulfillment",
      "method": "trackingRead"
    },
    {
      "domain": "payment",
      "method": "intentsCreate"
    },
    {
      "domain": "payment",
      "method": "intentsRead"
    },
    {
      "domain": "verification",
      "method": "sessionsRead"
    },
    {
      "domain": "voucher",
      "method": "searchRead"
    },
    {
      "domain": "voucher",
      "method": "activationsSecret"
    },
    {
      "domain": "voucher",
      "method": "activationsNumbersecret"
    },
    {
      "domain": "voucher",
      "method": "vouchersGet"
    },
    {
      "domain": "voucher",
      "method": "vouchersTimeline"
    },
    {
      "domain": "voucher",
      "method": "redemptionsGet"
    },
    {
      "domain": "benefit",
      "method": "accountsRead"
    },
    {
      "domain": "benefit",
      "method": "ledgersRead"
    },
    {
      "domain": "finance",
      "method": "invoicesRead"
    },
    {
      "domain": "finance",
      "method": "invoicesDownload"
    },
    {
      "domain": "invoice",
      "method": "profilesRead"
    },
    {
      "domain": "invoice",
      "method": "requestsCreate"
    },
    {
      "domain": "support",
      "method": "casesCreate"
    },
    {
      "domain": "support",
      "method": "casesRead"
    },
    {
      "domain": "support",
      "method": "messagesSend"
    },
    {
      "domain": "support",
      "method": "messagesRead"
    },
    {
      "domain": "support",
      "method": "attachmentsCreate"
    },
    {
      "domain": "support",
      "method": "eventsRead"
    },
    {
      "domain": "support",
      "method": "readstatesManage"
    },
    {
      "domain": "notification",
      "method": "notificationsRead"
    },
    {
      "domain": "notification",
      "method": "notificationsAck"
    },
    {
      "domain": "notification",
      "method": "preferencesRead"
    },
    {
      "domain": "notification",
      "method": "preferencesManage"
    },
    {
      "domain": "notification",
      "method": "endpointsManage"
    },
    {
      "domain": "observability",
      "method": "clienterrorsCreate"
    },
    {
      "domain": "identity",
      "method": "bootstrapRead"
    },
    {
      "domain": "identity",
      "method": "providersRead"
    },
    {
      "domain": "identity",
      "method": "federationsStart"
    },
    {
      "domain": "identity",
      "method": "federationsCallback"
    },
    {
      "domain": "identity",
      "method": "federationsSelectionRead"
    },
    {
      "domain": "identity",
      "method": "federationsComplete"
    },
    {
      "domain": "identity",
      "method": "linksRead"
    },
    {
      "domain": "identity",
      "method": "linksCreate"
    },
    {
      "domain": "identity",
      "method": "linksRevoke"
    },
    {
      "domain": "referral",
      "method": "membersApply"
    },
    {
      "domain": "referral",
      "method": "bindingsRead"
    },
    {
      "domain": "referral",
      "method": "bindingsCreate"
    },
    {
      "domain": "referral",
      "method": "earningsRead"
    },
    {
      "domain": "referral",
      "method": "linksRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsCreate"
    },
    {
      "domain": "order",
      "method": "ordersReceive"
    },
    {
      "domain": "checkout",
      "method": "quotesCurrentRead"
    },
    {
      "domain": "storefront",
      "method": "bootstrapRead"
    },
    {
      "domain": "storefront",
      "method": "catalogRead"
    }
  ],
  "store": [
    {
      "domain": "identity",
      "method": "sessionsCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsComplete"
    },
    {
      "domain": "identity",
      "method": "ticketsExchange"
    },
    {
      "domain": "identity",
      "method": "sessionRead"
    },
    {
      "domain": "identity",
      "method": "sessionDelete"
    },
    {
      "domain": "identity",
      "method": "handoversRead"
    },
    {
      "domain": "identity",
      "method": "handoversCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsRead"
    },
    {
      "domain": "identity",
      "method": "sessionsRevoke"
    },
    {
      "domain": "identity",
      "method": "membershipsRead"
    },
    {
      "domain": "identity",
      "method": "membershipsSwitch"
    },
    {
      "domain": "identity",
      "method": "challengesCreate"
    },
    {
      "domain": "identity",
      "method": "mobileChallengesCreate"
    },
    {
      "domain": "identity",
      "method": "invitationsResolve"
    },
    {
      "domain": "identity",
      "method": "enrollmentsRead"
    },
    {
      "domain": "identity",
      "method": "enrollmentsComplete"
    },
    {
      "domain": "identity",
      "method": "passwordChange"
    },
    {
      "domain": "identity",
      "method": "passwordVerify"
    },
    {
      "domain": "identity",
      "method": "passwordReset"
    },
    {
      "domain": "identity",
      "method": "mobileManage"
    },
    {
      "domain": "identity",
      "method": "stepupStart"
    },
    {
      "domain": "identity",
      "method": "stepupComplete"
    },
    {
      "domain": "identity",
      "method": "stepupDisable"
    },
    {
      "domain": "organization",
      "method": "layersRead"
    },
    {
      "domain": "capability",
      "method": "assignmentsRead"
    },
    {
      "domain": "organization",
      "method": "storesRead"
    },
    {
      "domain": "member",
      "method": "profileRead"
    },
    {
      "domain": "pricing",
      "method": "offersRead"
    },
    {
      "domain": "inventory",
      "method": "availabilityRead"
    },
    {
      "domain": "inventory",
      "method": "adjustmentsRead"
    },
    {
      "domain": "inventory",
      "method": "adjustmentsCreate"
    },
    {
      "domain": "experience",
      "method": "publishedRead"
    },
    {
      "domain": "order",
      "method": "ordersCancel"
    },
    {
      "domain": "order",
      "method": "ordersRead"
    },
    {
      "domain": "order",
      "method": "detailRead"
    },
    {
      "domain": "order",
      "method": "remindersCreate"
    },
    {
      "domain": "order",
      "method": "aftersalesRead"
    },
    {
      "domain": "fulfillment",
      "method": "workitemsRead"
    },
    {
      "domain": "fulfillment",
      "method": "workitemsTransition"
    },
    {
      "domain": "fulfillment",
      "method": "returnsRead"
    },
    {
      "domain": "fulfillment",
      "method": "shipmentsCreate"
    },
    {
      "domain": "fulfillment",
      "method": "returnsReceive"
    },
    {
      "domain": "fulfillment",
      "method": "returnsInspect"
    },
    {
      "domain": "verification",
      "method": "challengesIssue"
    },
    {
      "domain": "verification",
      "method": "challengesVerify"
    },
    {
      "domain": "verification",
      "method": "historyRead"
    },
    {
      "domain": "verification",
      "method": "devicesRead"
    },
    {
      "domain": "verification",
      "method": "devicesManage"
    },
    {
      "domain": "payment",
      "method": "refundsRequest"
    },
    {
      "domain": "payment",
      "method": "recoveriesRead"
    },
    {
      "domain": "payment",
      "method": "recoveriesResolve"
    },
    {
      "domain": "voucher",
      "method": "searchRead"
    },
    {
      "domain": "voucher",
      "method": "activationsSecret"
    },
    {
      "domain": "voucher",
      "method": "activationsNumbersecret"
    },
    {
      "domain": "voucher",
      "method": "vouchersBind"
    },
    {
      "domain": "voucher",
      "method": "vouchersUnbind"
    },
    {
      "domain": "voucher",
      "method": "vouchersGet"
    },
    {
      "domain": "voucher",
      "method": "vouchersGetbynumber"
    },
    {
      "domain": "voucher",
      "method": "vouchersTimeline"
    },
    {
      "domain": "voucher",
      "method": "redemptionsQuote"
    },
    {
      "domain": "voucher",
      "method": "tenderholdsCreate"
    },
    {
      "domain": "voucher",
      "method": "tenderholdsConsume"
    },
    {
      "domain": "voucher",
      "method": "tenderholdsRelease"
    },
    {
      "domain": "voucher",
      "method": "redemptionsCreate"
    },
    {
      "domain": "voucher",
      "method": "refundsCreate"
    },
    {
      "domain": "voucher",
      "method": "redemptionsGet"
    },
    {
      "domain": "support",
      "method": "casesRead"
    },
    {
      "domain": "support",
      "method": "messagesSend"
    },
    {
      "domain": "support",
      "method": "messagesRead"
    },
    {
      "domain": "support",
      "method": "attachmentsCreate"
    },
    {
      "domain": "support",
      "method": "eventsRead"
    },
    {
      "domain": "support",
      "method": "readstatesManage"
    },
    {
      "domain": "navigation",
      "method": "treeRead"
    },
    {
      "domain": "navigation",
      "method": "catalogRead"
    },
    {
      "domain": "identity",
      "method": "bootstrapRead"
    },
    {
      "domain": "identity",
      "method": "providersRead"
    },
    {
      "domain": "identity",
      "method": "federationsStart"
    },
    {
      "domain": "identity",
      "method": "federationsCallback"
    },
    {
      "domain": "identity",
      "method": "federationsSelectionRead"
    },
    {
      "domain": "identity",
      "method": "federationsComplete"
    },
    {
      "domain": "identity",
      "method": "linksRead"
    },
    {
      "domain": "identity",
      "method": "linksCreate"
    },
    {
      "domain": "identity",
      "method": "linksRevoke"
    },
    {
      "domain": "referral",
      "method": "membersApply"
    },
    {
      "domain": "referral",
      "method": "bindingsRead"
    },
    {
      "domain": "referral",
      "method": "bindingsCreate"
    },
    {
      "domain": "referral",
      "method": "earningsRead"
    },
    {
      "domain": "referral",
      "method": "linksRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsCreate"
    },
    {
      "domain": "order",
      "method": "ordersReceive"
    }
  ],
  "supplier": [
    {
      "domain": "runtime",
      "method": "uploadsCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsCreate"
    },
    {
      "domain": "identity",
      "method": "sessionsComplete"
    },
    {
      "domain": "identity",
      "method": "ticketsExchange"
    },
    {
      "domain": "identity",
      "method": "sessionRead"
    },
    {
      "domain": "identity",
      "method": "sessionDelete"
    },
    {
      "domain": "identity",
      "method": "sessionsRead"
    },
    {
      "domain": "identity",
      "method": "sessionsRevoke"
    },
    {
      "domain": "identity",
      "method": "membershipsRead"
    },
    {
      "domain": "identity",
      "method": "membershipsSwitch"
    },
    {
      "domain": "identity",
      "method": "challengesCreate"
    },
    {
      "domain": "identity",
      "method": "mobileChallengesCreate"
    },
    {
      "domain": "identity",
      "method": "invitationsResolve"
    },
    {
      "domain": "identity",
      "method": "enrollmentsRead"
    },
    {
      "domain": "identity",
      "method": "enrollmentsComplete"
    },
    {
      "domain": "identity",
      "method": "passwordChange"
    },
    {
      "domain": "identity",
      "method": "passwordVerify"
    },
    {
      "domain": "identity",
      "method": "passwordReset"
    },
    {
      "domain": "identity",
      "method": "mobileManage"
    },
    {
      "domain": "identity",
      "method": "stepupStart"
    },
    {
      "domain": "identity",
      "method": "stepupComplete"
    },
    {
      "domain": "identity",
      "method": "stepupDisable"
    },
    {
      "domain": "organization",
      "method": "layersRead"
    },
    {
      "domain": "capability",
      "method": "assignmentsRead"
    },
    {
      "domain": "partner",
      "method": "partnersRead"
    },
    {
      "domain": "member",
      "method": "profileRead"
    },
    {
      "domain": "catalog",
      "method": "poolsRead"
    },
    {
      "domain": "catalog",
      "method": "productDetailRead"
    },
    {
      "domain": "catalog",
      "method": "productsCreate"
    },
    {
      "domain": "catalog",
      "method": "productsUpdate"
    },
    {
      "domain": "catalog",
      "method": "listingsRead"
    },
    {
      "domain": "catalog",
      "method": "facetsRead"
    },
    {
      "domain": "catalog",
      "method": "listingsPriceSet"
    },
    {
      "domain": "catalog",
      "method": "importsCreate"
    },
    {
      "domain": "catalog",
      "method": "importsRead"
    },
    {
      "domain": "pricing",
      "method": "offersRead"
    },
    {
      "domain": "inventory",
      "method": "availabilityRead"
    },
    {
      "domain": "inventory",
      "method": "importsCreate"
    },
    {
      "domain": "inventory",
      "method": "importsRead"
    },
    {
      "domain": "experience",
      "method": "publishedRead"
    },
    {
      "domain": "order",
      "method": "ordersCancel"
    },
    {
      "domain": "order",
      "method": "ordersRead"
    },
    {
      "domain": "order",
      "method": "detailRead"
    },
    {
      "domain": "order",
      "method": "remindersCreate"
    },
    {
      "domain": "order",
      "method": "aftersalesRead"
    },
    {
      "domain": "fulfillment",
      "method": "workitemsRead"
    },
    {
      "domain": "fulfillment",
      "method": "workitemsTransition"
    },
    {
      "domain": "fulfillment",
      "method": "returnsRead"
    },
    {
      "domain": "fulfillment",
      "method": "shipmentsCreate"
    },
    {
      "domain": "fulfillment",
      "method": "returnsReceive"
    },
    {
      "domain": "fulfillment",
      "method": "returnsInspect"
    },
    {
      "domain": "voucher",
      "method": "searchRead"
    },
    {
      "domain": "voucher",
      "method": "activationsSecret"
    },
    {
      "domain": "voucher",
      "method": "activationsNumbersecret"
    },
    {
      "domain": "voucher",
      "method": "vouchersGet"
    },
    {
      "domain": "voucher",
      "method": "vouchersTimeline"
    },
    {
      "domain": "voucher",
      "method": "redemptionsGet"
    },
    {
      "domain": "finance",
      "method": "overviewRead"
    },
    {
      "domain": "finance",
      "method": "entriesRead"
    },
    {
      "domain": "finance",
      "method": "statementsRead"
    },
    {
      "domain": "finance",
      "method": "statementsExport"
    },
    {
      "domain": "finance",
      "method": "reconciliationsRead"
    },
    {
      "domain": "finance",
      "method": "settlementsRead"
    },
    {
      "domain": "invoice",
      "method": "requestsRead"
    },
    {
      "domain": "support",
      "method": "casesRead"
    },
    {
      "domain": "support",
      "method": "messagesSend"
    },
    {
      "domain": "support",
      "method": "messagesRead"
    },
    {
      "domain": "support",
      "method": "attachmentsCreate"
    },
    {
      "domain": "support",
      "method": "eventsRead"
    },
    {
      "domain": "support",
      "method": "readstatesManage"
    },
    {
      "domain": "channel",
      "method": "connectionsRead"
    },
    {
      "domain": "channel",
      "method": "connectionsTest"
    },
    {
      "domain": "channel",
      "method": "syncrunsRead"
    },
    {
      "domain": "channel",
      "method": "operationsRead"
    },
    {
      "domain": "navigation",
      "method": "treeRead"
    },
    {
      "domain": "navigation",
      "method": "catalogRead"
    },
    {
      "domain": "identity",
      "method": "bootstrapRead"
    },
    {
      "domain": "identity",
      "method": "providersRead"
    },
    {
      "domain": "identity",
      "method": "federationsStart"
    },
    {
      "domain": "identity",
      "method": "federationsCallback"
    },
    {
      "domain": "identity",
      "method": "federationsSelectionRead"
    },
    {
      "domain": "identity",
      "method": "federationsComplete"
    },
    {
      "domain": "identity",
      "method": "linksRead"
    },
    {
      "domain": "identity",
      "method": "linksCreate"
    },
    {
      "domain": "identity",
      "method": "linksRevoke"
    },
    {
      "domain": "referral",
      "method": "membersApply"
    },
    {
      "domain": "referral",
      "method": "bindingsRead"
    },
    {
      "domain": "referral",
      "method": "bindingsCreate"
    },
    {
      "domain": "referral",
      "method": "earningsRead"
    },
    {
      "domain": "referral",
      "method": "linksRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsRead"
    },
    {
      "domain": "referral",
      "method": "withdrawalsCreate"
    },
    {
      "domain": "order",
      "method": "ordersReceive"
    }
  ]
} as const);
export const MINIAPP_TRANSPORT_POLICY = Object.freeze({ transport: 'wechat', credentials: 'session', maximumResponseBytes: 1048576, allowedHeaders: Object.freeze(['content-type', 'idempotency-key', 'if-match', 'x-client-target', 'x-contract-version', 'x-csrf-token', 'x-request-id', 'x-scope-id', 'x-scope-kind', 'x-trace-id']) } as const);

export interface AuthSurfaceClient {
  readonly identity: Pick<CommerceClient["identity"], "sessionsCreate" | "sessionsComplete" | "ticketsExchange" | "sessionRead" | "sessionDelete" | "sessionsRead" | "sessionsRevoke" | "membershipsRead" | "membershipsSwitch" | "challengesCreate" | "mobileChallengesCreate" | "invitationsResolve" | "enrollmentsRead" | "enrollmentsComplete" | "passwordChange" | "passwordVerify" | "passwordReset" | "mobileManage" | "stepupStart" | "stepupComplete" | "stepupDisable" | "bootstrapRead" | "providersRead" | "federationsStart" | "federationsCallback" | "federationsSelectionRead" | "federationsComplete" | "linksRead" | "linksCreate" | "linksRevoke">;
}

export interface ConsoleSurfaceClient {
  readonly runtime: Pick<CommerceClient["runtime"], "healthDependency" | "jobsRead" | "jobsCancel" | "uploadsCreate" | "importsCreate" | "importsRead" | "importsConfirm" | "importsRetry" | "exportsRead" | "exportsCancel">;
  readonly identity: Pick<CommerceClient["identity"], "sessionsCreate" | "sessionsComplete" | "ticketsExchange" | "sessionRead" | "sessionDelete" | "handoversRead" | "handoversCreate" | "sessionsRead" | "sessionsRevoke" | "membershipsRead" | "membershipsSwitch" | "challengesCreate" | "mobileChallengesCreate" | "invitationsResolve" | "invitationsRead" | "invitationsCreate" | "invitationsRevoke" | "enrollmentsRead" | "enrollmentsComplete" | "membersManage" | "passwordChange" | "passwordVerify" | "passwordReset" | "mobileManage" | "stepupStart" | "stepupComplete" | "stepupDisable" | "bootstrapRead" | "providersRead" | "federationsStart" | "federationsCallback" | "federationsSelectionRead" | "federationsComplete" | "linksRead" | "linksCreate" | "linksRevoke" | "providersCenterRead" | "providersManage" | "providersTest">;
  readonly organization: Pick<CommerceClient["organization"], "layersRead" | "mallsCreate" | "mallsRead" | "mallsUpdate" | "storesRead" | "storesManage" | "directoriesRead" | "directoriesManage" | "directoriesSync" | "directoriesSyncrunsRead">;
  readonly access: Pick<CommerceClient["access"], "centerRead" | "ownershipRead" | "ownershipTransfersPreview" | "ownershipTransfersCreate" | "ownershipTransfersAcceptPreview" | "ownershipTransfersAccept" | "ownershipTransfersCancelPreview" | "ownershipTransfersCancel" | "rolesManage" | "overridesManage" | "scopesManage">;
  readonly capability: Pick<CommerceClient["capability"], "assignmentsRead" | "assignmentsManage">;
  readonly partner: Pick<CommerceClient["partner"], "partnersRead" | "customersCreate" | "customersUpdate" | "customersEnable" | "customersDisable" | "customersGet" | "customersList" | "customeroptionsList" | "partnersManage">;
  readonly member: Pick<CommerceClient["member"], "membersRead" | "profileRead" | "importsCreate" | "importsRead">;
  readonly qualification: Pick<CommerceClient["qualification"], "centerRead" | "decisionsPreview" | "policiesManage" | "qualificationsPublish" | "qualificationsRevoke" | "evidenceuploadsCreate">;
  readonly channel: Pick<CommerceClient["channel"], "distributorsCreate" | "distributorsRead" | "distributorsUpdate" | "distributorsDisable" | "bindingsManage" | "quotasManage" | "connectionsRead" | "connectionsCreate" | "connectionsUpdate" | "connectionsTest" | "connectionsEnable" | "connectionsDisable" | "syncrunsStart" | "syncrunsRead" | "syncrunsCancel" | "operationsRead" | "operationsReplay">;
  readonly catalog: Pick<CommerceClient["catalog"], "poolsRead" | "poolsAttach" | "poolsDetach" | "poolsAllocate" | "productDetailRead" | "productsCreate" | "productsUpdate" | "productsArchive" | "listingsRead" | "facetsRead" | "listingsPublish" | "listingsPriceSet" | "listingsPoolSet" | "listingsUnpublish" | "listingsBatch" | "importsCreate" | "importsRead">;
  readonly pricing: Pick<CommerceClient["pricing"], "rulesCreate" | "rulesPublish" | "offersRead">;
  readonly inventory: Pick<CommerceClient["inventory"], "availabilityRead" | "adjustmentsRead" | "adjustmentsCreate" | "importsCreate" | "importsRead">;
  readonly marketing: Pick<CommerceClient["marketing"], "campaignsRead" | "campaignsCreate" | "campaignsRevise" | "campaignsPublish" | "campaignsDisable">;
  readonly reporting: Pick<CommerceClient["reporting"], "dashboardRead" | "salesRead" | "productsRead" | "mallsRead" | "categoriesRead" | "channelsRead" | "voucherconsumptionRead" | "exportsCreate" | "exportsRead">;
  readonly experience: Pick<CommerceClient["experience"], "applicationsCreate" | "applicationsCopy" | "applicationsDetailRead" | "applicationsRead" | "applicationsUpdate" | "versionsSave" | "versionsValidate" | "versionsPublish" | "versionsRestore" | "publishedRead">;
  readonly order: Pick<CommerceClient["order"], "ordersCancel" | "ordersRead" | "detailRead" | "remindersCreate" | "ordersExport" | "importsCreate" | "importsRead" | "aftersalesRead" | "aftersalesApprove" | "aftersalesReject" | "ordersReceive">;
  readonly fulfillment: Pick<CommerceClient["fulfillment"], "workitemsRead" | "workitemsTransition" | "returnsRead" | "shipmentsCreate" | "returnsReceive" | "returnsInspect">;
  readonly verification: Pick<CommerceClient["verification"], "challengesIssue" | "challengesVerify" | "historyRead" | "devicesRead" | "devicesManage">;
  readonly payment: Pick<CommerceClient["payment"], "refundsRequest" | "recoveriesRead" | "recoveriesResolve">;
  readonly voucher: Pick<CommerceClient["voucher"], "productsCreate" | "productsRevise" | "productsEnable" | "productsDisable" | "productsGet" | "productsList" | "productoptionsList" | "credentialpoolsCreate" | "credentialsGenerate" | "credentialsImport" | "credentialpoolsClose" | "credentialpoolsGet" | "credentialpoolsList" | "credentialsList" | "credentialsGet" | "credentialexportsCreate" | "jobsGet" | "stockrequestsCreate" | "stockrequestsUpdate" | "stockrequestsSubmit" | "stockrequestsCancel" | "stockrequestsGet" | "stockrequestsList" | "stockrequestoptionsList" | "issueordersCreate" | "issueordersUpdate" | "issueordersSubmit" | "issueordersCancel" | "issueordersGet" | "issueordersList" | "issuebatchesRetry" | "issuebatchesGet" | "issueorderexportsCreate" | "actionbatchesCreate" | "actionbatchesGet" | "actionbatchesList" | "actionbatchesRetry" | "actionexportsCreate" | "searchRead" | "activationsSecret" | "activationsNumbersecret" | "vouchersBind" | "vouchersUnbind" | "vouchersGet" | "vouchersGetbynumber" | "vouchersTimeline" | "redemptionsQuote" | "tenderholdsCreate" | "tenderholdsConsume" | "tenderholdsRelease" | "redemptionsCreate" | "refundsCreate" | "redemptionsGet" | "searchfacetsRead" | "searchsnapshotsCreate" | "searchexportsCreate" | "exportsGet">;
  readonly benefit: Pick<CommerceClient["benefit"], "plansRead" | "plansManage" | "budgetsRead" | "budgetsManage" | "grantsCreate" | "grantsDecide" | "grantsRead" | "grantsControl" | "grantsRevoke" | "lotsRead">;
  readonly finance: Pick<CommerceClient["finance"], "overviewRead" | "facetsRead" | "auditRead" | "entriesRead" | "statementimportsCreate" | "statementimportsRead" | "statementsRead" | "statementsExport" | "reconciliationsManage" | "reconciliationsRead" | "settlementsRead" | "settlementsDecide" | "settlementsAdjust" | "withdrawalsRead" | "withdrawalsCreate" | "withdrawalsDecide" | "withdrawalsRecover" | "holdsRead" | "periodsRead" | "periodsManage" | "backfillsRead" | "backfillsDecide" | "policiesManage" | "policiesRead" | "policiesPreview" | "reconciliationrepairsRead" | "reconciliationrepairsPreview" | "reconciliationrepairsSubmit" | "reconciliationrepairsDecide" | "reconciliationrepairsReverse">;
  readonly invoice: Pick<CommerceClient["invoice"], "profilesManage" | "requestsRead" | "requestsCancel" | "requestsDecide" | "requestsRed">;
  readonly support: Pick<CommerceClient["support"], "casesRead" | "casesUpdate" | "casesClose" | "casesReopen" | "messagesSend" | "messagesRead" | "attachmentsCreate" | "assignmentsManage" | "agentsManage" | "agentsRead" | "accountsManage" | "accountsRead" | "rulesRead" | "rulesManage" | "slasRead" | "slasManage" | "historyRead" | "eventsRead" | "readstatesManage">;
  readonly notification: Pick<CommerceClient["notification"], "templatesManage" | "templatesRead" | "announcementsRead" | "announcementsManage">;
  readonly risk: Pick<CommerceClient["risk"], "centerRead" | "policiesManage" | "casesReview">;
  readonly audit: Pick<CommerceClient["audit"], "recordsRead">;
  readonly observability: Pick<CommerceClient["observability"], "clienterrorsRead" | "healthoverviewRead" | "sloRead">;
  readonly extension: Pick<CommerceClient["extension"], "installationsRead">;
  readonly navigation: Pick<CommerceClient["navigation"], "treeRead" | "catalogRead">;
  readonly referral: Pick<CommerceClient["referral"], "settingsRead" | "settingsManage" | "productsRead" | "productsManage" | "membersRead" | "membersApply" | "membersApprove" | "membersDisqualify" | "bindingsRead" | "bindingsCreate" | "commissionsRead" | "earningsRead" | "linksRead" | "withdrawalsRead" | "withdrawalsCreate">;
  readonly approval: Pick<CommerceClient["approval"], "templatesCreate" | "templatesRevise" | "templatesEnable" | "templatesDisable" | "templatesGet" | "templatesList" | "tasksList" | "tasksApprove" | "tasksReject" | "instancesGet">;
}

export interface StorefrontSurfaceClient {
  readonly identity: Pick<CommerceClient["identity"], "sessionsCreate" | "sessionsComplete" | "ticketsExchange" | "sessionRead" | "sessionDelete" | "sessionsRead" | "sessionsRevoke" | "membershipsRead" | "membershipsSwitch" | "challengesCreate" | "mobileChallengesCreate" | "invitationsResolve" | "enrollmentsRead" | "enrollmentsComplete" | "passwordChange" | "passwordVerify" | "passwordReset" | "mobileManage" | "stepupStart" | "stepupComplete" | "stepupDisable" | "bootstrapRead" | "providersRead" | "federationsStart" | "federationsCallback" | "federationsSelectionRead" | "federationsComplete" | "linksRead" | "linksCreate" | "linksRevoke">;
  readonly member: Pick<CommerceClient["member"], "profileRead" | "addressesRead" | "addressesManage" | "favoritesRead" | "favoritesPut">;
  readonly pricing: Pick<CommerceClient["pricing"], "offersRead">;
  readonly inventory: Pick<CommerceClient["inventory"], "availabilityRead">;
  readonly experience: Pick<CommerceClient["experience"], "publishedRead">;
  readonly cart: Pick<CommerceClient["cart"], "currentRead" | "anonymousMerge" | "itemsPut" | "itemsBatch">;
  readonly checkout: Pick<CommerceClient["checkout"], "quoteCreate" | "quotesCurrentRead">;
  readonly order: Pick<CommerceClient["order"], "ordersCreate" | "ordersCancel" | "ordersRead" | "detailRead" | "remindersCreate" | "aftersalesRead" | "aftersaleattachmentsCreate" | "aftersalesApply" | "ordersReceive">;
  readonly fulfillment: Pick<CommerceClient["fulfillment"], "trackingRead">;
  readonly payment: Pick<CommerceClient["payment"], "intentsCreate" | "intentsRead">;
  readonly verification: Pick<CommerceClient["verification"], "sessionsRead">;
  readonly voucher: Pick<CommerceClient["voucher"], "searchRead" | "activationsSecret" | "activationsNumbersecret" | "vouchersGet" | "vouchersTimeline" | "redemptionsGet">;
  readonly benefit: Pick<CommerceClient["benefit"], "accountsRead" | "ledgersRead">;
  readonly finance: Pick<CommerceClient["finance"], "invoicesRead" | "invoicesDownload">;
  readonly invoice: Pick<CommerceClient["invoice"], "profilesRead" | "requestsCreate">;
  readonly support: Pick<CommerceClient["support"], "casesCreate" | "casesRead" | "messagesSend" | "messagesRead" | "attachmentsCreate" | "eventsRead" | "readstatesManage">;
  readonly notification: Pick<CommerceClient["notification"], "notificationsRead" | "notificationsAck" | "preferencesRead" | "preferencesManage" | "endpointsManage">;
  readonly observability: Pick<CommerceClient["observability"], "clienterrorsCreate">;
  readonly referral: Pick<CommerceClient["referral"], "membersApply" | "bindingsRead" | "bindingsCreate" | "earningsRead" | "linksRead" | "withdrawalsRead" | "withdrawalsCreate">;
  readonly storefront: Pick<CommerceClient["storefront"], "bootstrapRead" | "catalogRead">;
}

export interface MiniappSurfaceClient {
  readonly identity: Pick<CommerceClient["identity"], "sessionsCreate" | "sessionsComplete" | "ticketsExchange" | "sessionRead" | "sessionDelete" | "sessionsRead" | "sessionsRevoke" | "membershipsRead" | "membershipsSwitch" | "challengesCreate" | "mobileChallengesCreate" | "invitationsResolve" | "enrollmentsRead" | "enrollmentsComplete" | "passwordChange" | "passwordVerify" | "passwordReset" | "mobileManage" | "stepupStart" | "stepupComplete" | "stepupDisable" | "bootstrapRead" | "providersRead" | "federationsStart" | "federationsCallback" | "federationsSelectionRead" | "federationsComplete" | "linksRead" | "linksCreate" | "linksRevoke">;
  readonly member: Pick<CommerceClient["member"], "profileRead" | "addressesRead" | "addressesManage" | "favoritesRead" | "favoritesPut">;
  readonly pricing: Pick<CommerceClient["pricing"], "offersRead">;
  readonly inventory: Pick<CommerceClient["inventory"], "availabilityRead">;
  readonly experience: Pick<CommerceClient["experience"], "publishedRead">;
  readonly cart: Pick<CommerceClient["cart"], "currentRead" | "anonymousMerge" | "itemsPut" | "itemsBatch">;
  readonly checkout: Pick<CommerceClient["checkout"], "quoteCreate" | "quotesCurrentRead">;
  readonly order: Pick<CommerceClient["order"], "ordersCreate" | "ordersCancel" | "ordersRead" | "detailRead" | "remindersCreate" | "aftersalesRead" | "aftersaleattachmentsCreate" | "aftersalesApply" | "ordersReceive">;
  readonly fulfillment: Pick<CommerceClient["fulfillment"], "trackingRead">;
  readonly payment: Pick<CommerceClient["payment"], "intentsCreate" | "intentsRead">;
  readonly verification: Pick<CommerceClient["verification"], "sessionsRead">;
  readonly voucher: Pick<CommerceClient["voucher"], "searchRead" | "activationsSecret" | "activationsNumbersecret" | "vouchersGet" | "vouchersTimeline" | "redemptionsGet">;
  readonly benefit: Pick<CommerceClient["benefit"], "accountsRead" | "ledgersRead">;
  readonly finance: Pick<CommerceClient["finance"], "invoicesRead" | "invoicesDownload">;
  readonly invoice: Pick<CommerceClient["invoice"], "profilesRead" | "requestsCreate">;
  readonly support: Pick<CommerceClient["support"], "casesCreate" | "casesRead" | "messagesSend" | "messagesRead" | "attachmentsCreate" | "eventsRead" | "readstatesManage">;
  readonly notification: Pick<CommerceClient["notification"], "notificationsRead" | "notificationsAck" | "preferencesRead" | "preferencesManage" | "endpointsManage">;
  readonly observability: Pick<CommerceClient["observability"], "clienterrorsCreate">;
  readonly referral: Pick<CommerceClient["referral"], "membersApply" | "bindingsRead" | "bindingsCreate" | "earningsRead" | "linksRead" | "withdrawalsRead" | "withdrawalsCreate">;
  readonly storefront: Pick<CommerceClient["storefront"], "bootstrapRead" | "catalogRead">;
}

export interface StoreSurfaceClient {
  readonly identity: Pick<CommerceClient["identity"], "sessionsCreate" | "sessionsComplete" | "ticketsExchange" | "sessionRead" | "sessionDelete" | "handoversRead" | "handoversCreate" | "sessionsRead" | "sessionsRevoke" | "membershipsRead" | "membershipsSwitch" | "challengesCreate" | "mobileChallengesCreate" | "invitationsResolve" | "enrollmentsRead" | "enrollmentsComplete" | "passwordChange" | "passwordVerify" | "passwordReset" | "mobileManage" | "stepupStart" | "stepupComplete" | "stepupDisable" | "bootstrapRead" | "providersRead" | "federationsStart" | "federationsCallback" | "federationsSelectionRead" | "federationsComplete" | "linksRead" | "linksCreate" | "linksRevoke">;
  readonly organization: Pick<CommerceClient["organization"], "layersRead" | "storesRead">;
  readonly capability: Pick<CommerceClient["capability"], "assignmentsRead">;
  readonly member: Pick<CommerceClient["member"], "profileRead">;
  readonly pricing: Pick<CommerceClient["pricing"], "offersRead">;
  readonly inventory: Pick<CommerceClient["inventory"], "availabilityRead" | "adjustmentsRead" | "adjustmentsCreate">;
  readonly experience: Pick<CommerceClient["experience"], "publishedRead">;
  readonly order: Pick<CommerceClient["order"], "ordersCancel" | "ordersRead" | "detailRead" | "remindersCreate" | "aftersalesRead" | "ordersReceive">;
  readonly fulfillment: Pick<CommerceClient["fulfillment"], "workitemsRead" | "workitemsTransition" | "returnsRead" | "shipmentsCreate" | "returnsReceive" | "returnsInspect">;
  readonly verification: Pick<CommerceClient["verification"], "challengesIssue" | "challengesVerify" | "historyRead" | "devicesRead" | "devicesManage">;
  readonly payment: Pick<CommerceClient["payment"], "refundsRequest" | "recoveriesRead" | "recoveriesResolve">;
  readonly voucher: Pick<CommerceClient["voucher"], "searchRead" | "activationsSecret" | "activationsNumbersecret" | "vouchersBind" | "vouchersUnbind" | "vouchersGet" | "vouchersGetbynumber" | "vouchersTimeline" | "redemptionsQuote" | "tenderholdsCreate" | "tenderholdsConsume" | "tenderholdsRelease" | "redemptionsCreate" | "refundsCreate" | "redemptionsGet">;
  readonly support: Pick<CommerceClient["support"], "casesRead" | "messagesSend" | "messagesRead" | "attachmentsCreate" | "eventsRead" | "readstatesManage">;
  readonly navigation: Pick<CommerceClient["navigation"], "treeRead" | "catalogRead">;
  readonly referral: Pick<CommerceClient["referral"], "membersApply" | "bindingsRead" | "bindingsCreate" | "earningsRead" | "linksRead" | "withdrawalsRead" | "withdrawalsCreate">;
}

export interface SupplierSurfaceClient {
  readonly runtime: Pick<CommerceClient["runtime"], "uploadsCreate">;
  readonly identity: Pick<CommerceClient["identity"], "sessionsCreate" | "sessionsComplete" | "ticketsExchange" | "sessionRead" | "sessionDelete" | "sessionsRead" | "sessionsRevoke" | "membershipsRead" | "membershipsSwitch" | "challengesCreate" | "mobileChallengesCreate" | "invitationsResolve" | "enrollmentsRead" | "enrollmentsComplete" | "passwordChange" | "passwordVerify" | "passwordReset" | "mobileManage" | "stepupStart" | "stepupComplete" | "stepupDisable" | "bootstrapRead" | "providersRead" | "federationsStart" | "federationsCallback" | "federationsSelectionRead" | "federationsComplete" | "linksRead" | "linksCreate" | "linksRevoke">;
  readonly organization: Pick<CommerceClient["organization"], "layersRead">;
  readonly capability: Pick<CommerceClient["capability"], "assignmentsRead">;
  readonly partner: Pick<CommerceClient["partner"], "partnersRead">;
  readonly member: Pick<CommerceClient["member"], "profileRead">;
  readonly catalog: Pick<CommerceClient["catalog"], "poolsRead" | "productDetailRead" | "productsCreate" | "productsUpdate" | "listingsRead" | "facetsRead" | "listingsPriceSet" | "importsCreate" | "importsRead">;
  readonly pricing: Pick<CommerceClient["pricing"], "offersRead">;
  readonly inventory: Pick<CommerceClient["inventory"], "availabilityRead" | "importsCreate" | "importsRead">;
  readonly experience: Pick<CommerceClient["experience"], "publishedRead">;
  readonly order: Pick<CommerceClient["order"], "ordersCancel" | "ordersRead" | "detailRead" | "remindersCreate" | "aftersalesRead" | "ordersReceive">;
  readonly fulfillment: Pick<CommerceClient["fulfillment"], "workitemsRead" | "workitemsTransition" | "returnsRead" | "shipmentsCreate" | "returnsReceive" | "returnsInspect">;
  readonly voucher: Pick<CommerceClient["voucher"], "searchRead" | "activationsSecret" | "activationsNumbersecret" | "vouchersGet" | "vouchersTimeline" | "redemptionsGet">;
  readonly finance: Pick<CommerceClient["finance"], "overviewRead" | "entriesRead" | "statementsRead" | "statementsExport" | "reconciliationsRead" | "settlementsRead">;
  readonly invoice: Pick<CommerceClient["invoice"], "requestsRead">;
  readonly support: Pick<CommerceClient["support"], "casesRead" | "messagesSend" | "messagesRead" | "attachmentsCreate" | "eventsRead" | "readstatesManage">;
  readonly channel: Pick<CommerceClient["channel"], "connectionsRead" | "connectionsTest" | "syncrunsRead" | "operationsRead">;
  readonly navigation: Pick<CommerceClient["navigation"], "treeRead" | "catalogRead">;
  readonly referral: Pick<CommerceClient["referral"], "membersApply" | "bindingsRead" | "bindingsCreate" | "earningsRead" | "linksRead" | "withdrawalsRead" | "withdrawalsCreate">;
}

export interface SurfaceClientMap {
  readonly auth: AuthSurfaceClient;
  readonly console: ConsoleSurfaceClient;
  readonly storefront: StorefrontSurfaceClient;
  readonly miniapp: MiniappSurfaceClient;
  readonly store: StoreSurfaceClient;
  readonly supplier: SupplierSurfaceClient;
}

export function createSurfaceClient<TSurface extends ClientSurface>(surface: TSurface, executor: OperationExecutor): SurfaceClientMap[TSurface] {
  const commerce = createCommerceClient(executor) as unknown as Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  const selected: Record<string, Record<string, unknown>> = {};
  for (const descriptor of SURFACE_METHODS[surface]) {
    const operation = commerce[descriptor.domain]?.[descriptor.method];
    if (operation === undefined) throw new Error(`SURFACE_OPERATION_MISSING:${surface}:${descriptor.domain}.${descriptor.method}`);
    (selected[descriptor.domain] ??= {})[descriptor.method] = operation;
  }
  return Object.freeze(Object.fromEntries(Object.entries(selected).map(([domain, value]) => [domain, Object.freeze(value)]))) as unknown as SurfaceClientMap[TSurface];
}
