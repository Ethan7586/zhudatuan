// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from '../OperationCatalog';
import { structuralOperationInput, structuralOperationOutput, type SchemaOutput } from '../schema';

export const OPERATION_SCHEMAS = Object.freeze({
  "runtime.health.live": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "runtime.health.ready": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "runtime.health.startup": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "runtime.health.dependency": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.sessions.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.tickets.exchange": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.session.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.session.delete": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.sessions.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.sessions.revoke": Object.freeze({ input: structuralOperationInput(["sessionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.challenges.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.invitations.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.invitations.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.invitations.revoke": Object.freeze({ input: structuralOperationInput(["invitationid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.members.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.members.manage": Object.freeze({ input: structuralOperationInput(["membershipid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  "identity.members.reset": Object.freeze({ input: structuralOperationInput(["membershipid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.password.change": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.password.verify": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.password.reset": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.mobile.challenge": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
=======
  "identity.password.change": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.password.verify": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.password.reset": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  "identity.password.change": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.password.verify": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.password.reset": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  "identity.mobile.manage": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.stepup.start": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.stepup.complete": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.wechat.session": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "identity.wechat.bind": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "organization.layers.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.center.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.roles.manage": Object.freeze({ input: structuralOperationInput(["roleid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.scopes.manage": Object.freeze({ input: structuralOperationInput(["membershipid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  "access.ownership.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.ownership.transfers.preview": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.ownership.transfers.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.ownership.transfers.accept.preview": Object.freeze({ input: structuralOperationInput(["transferid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.ownership.transfers.accept": Object.freeze({ input: structuralOperationInput(["transferid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.ownership.transfers.cancel": Object.freeze({ input: structuralOperationInput(["transferid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "access.ownership.transfers.cancel.preview": Object.freeze({ input: structuralOperationInput(["transferid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  "capability.assignments.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "capability.assignments.manage": Object.freeze({ input: structuralOperationInput(["assignmentid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "partner.partners.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "partner.partners.manage": Object.freeze({ input: structuralOperationInput(["partnerid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "organization.stores.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "organization.stores.manage": Object.freeze({ input: structuralOperationInput(["storeid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "member.members.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "member.profile.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "member.addresses.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "member.addresses.manage": Object.freeze({ input: structuralOperationInput(["addressid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "member.imports.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "member.imports.read": Object.freeze({ input: structuralOperationInput(["importid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "qualification.center.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "qualification.decisions.preview": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "qualification.policies.manage": Object.freeze({ input: structuralOperationInput(["policyid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.distributors.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.distributors.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.distributors.update": Object.freeze({ input: structuralOperationInput(["distributorid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.distributors.disable": Object.freeze({ input: structuralOperationInput(["distributorid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.bindings.manage": Object.freeze({ input: structuralOperationInput(["bindingid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.quotas.manage": Object.freeze({ input: structuralOperationInput(["quotaid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.pools.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.pools.attach": Object.freeze({ input: structuralOperationInput(["poolid","scopeid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.pools.detach": Object.freeze({ input: structuralOperationInput(["poolid","scopeid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.pools.allocate": Object.freeze({ input: structuralOperationInput(["poolid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.products.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.products.update": Object.freeze({ input: structuralOperationInput(["productid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.products.archive": Object.freeze({ input: structuralOperationInput(["productid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.listings.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.listings.publish": Object.freeze({ input: structuralOperationInput(["listingid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.listings.unpublish": Object.freeze({ input: structuralOperationInput(["listingid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.listings.batch": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.imports.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "catalog.imports.read": Object.freeze({ input: structuralOperationInput(["importid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "pricing.rules.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "pricing.rules.publish": Object.freeze({ input: structuralOperationInput(["ruleid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "pricing.offers.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "inventory.availability.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "inventory.imports.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "inventory.imports.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "marketing.campaigns.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  "referral.settings.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.settings.manage": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.products.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.products.manage": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.members.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.members.apply": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.members.approve": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.members.disqualify": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.bindings.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.bindings.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.commissions.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.earnings.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.links.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.withdrawals.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "referral.withdrawals.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  "reporting.dashboard.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.sales.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.products.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.malls.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.categories.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.channels.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.powderclass.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.voucherconsumption.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.exports.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "reporting.exports.read": Object.freeze({ input: structuralOperationInput(["exportid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.applications.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.published.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.applications.copy": Object.freeze({ input: structuralOperationInput(["applicationid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.applications.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.applications.update": Object.freeze({ input: structuralOperationInput(["applicationid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.versions.save": Object.freeze({ input: structuralOperationInput(["applicationid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.versions.validate": Object.freeze({ input: structuralOperationInput(["versionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.versions.publish": Object.freeze({ input: structuralOperationInput(["versionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "experience.versions.restore": Object.freeze({ input: structuralOperationInput(["versionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "cart.current.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "cart.items.put": Object.freeze({ input: structuralOperationInput(["listingid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "cart.items.batch": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "checkout.quote.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.orders.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.orders.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.reminders.create": Object.freeze({ input: structuralOperationInput(["orderid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.orders.export": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.aftersales.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.aftersales.apply": Object.freeze({ input: structuralOperationInput(["orderid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.aftersales.approve": Object.freeze({ input: structuralOperationInput(["aftersaleid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "order.aftersales.reject": Object.freeze({ input: structuralOperationInput(["aftersaleid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "fulfillment.shipments.create": Object.freeze({ input: structuralOperationInput(["fulfillmentid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "fulfillment.tracking.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "fulfillment.returns.receive": Object.freeze({ input: structuralOperationInput(["returnid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "fulfillment.returns.inspect": Object.freeze({ input: structuralOperationInput(["returnid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "payment.intents.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "verification.challenges.issue": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "verification.sessions.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "verification.challenges.verify": Object.freeze({ input: structuralOperationInput(["challengeid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "verification.history.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "verification.devices.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "verification.devices.manage": Object.freeze({ input: structuralOperationInput(["deviceid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "payment.refunds.request": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "payment.recoveries.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "payment.recoveries.resolve": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "payment.webhooks.wechat": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.cardlibraries.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.cardlibraries.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.cardlibraries.allocate": Object.freeze({ input: structuralOperationInput(["libraryid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.imports.read": Object.freeze({ input: structuralOperationInput(["importid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.programs.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.programs.manage": Object.freeze({ input: structuralOperationInput(["programid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.reserves.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.reserves.request": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.reserves.decide": Object.freeze({ input: structuralOperationInput(["reserveid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.batches.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.batches.issue": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.batches.retry": Object.freeze({ input: structuralOperationInput(["batchid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.status.batch": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.statusbatches.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.bindings.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.bindings.manage": Object.freeze({ input: structuralOperationInput(["voucherid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.redemptions.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.history.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "voucher.redemptions.reverse": Object.freeze({ input: structuralOperationInput(["redemptionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.accounts.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.ledgers.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.plans.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.plans.manage": Object.freeze({ input: structuralOperationInput(["planid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.budgets.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.budgets.manage": Object.freeze({ input: structuralOperationInput(["budgetid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.grants.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.grants.decide": Object.freeze({ input: structuralOperationInput(["batchid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.grants.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.grants.control": Object.freeze({ input: structuralOperationInput(["batchid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.grants.revoke": Object.freeze({ input: structuralOperationInput(["batchid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "benefit.lots.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.overview.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.entries.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.statements.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.statements.export": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.reconciliations.manage": Object.freeze({ input: structuralOperationInput(["reconciliationid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.reconciliations.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  "finance.reconciliationrepairs.read": Object.freeze({ input: structuralOperationInput(["repairid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.reconciliationrepairs.preview": Object.freeze({ input: structuralOperationInput(["reconciliationid","itemid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.reconciliationrepairs.submit": Object.freeze({ input: structuralOperationInput(["repairid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.reconciliationrepairs.decide": Object.freeze({ input: structuralOperationInput(["repairid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.reconciliationrepairs.reverse": Object.freeze({ input: structuralOperationInput(["repairid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  "finance.settlements.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.settlements.decide": Object.freeze({ input: structuralOperationInput(["settlementid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.settlements.adjust": Object.freeze({ input: structuralOperationInput(["settlementid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.withdrawals.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.withdrawals.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.withdrawals.decide": Object.freeze({ input: structuralOperationInput(["withdrawalid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.withdrawals.recover": Object.freeze({ input: structuralOperationInput(["withdrawalid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.holds.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.periods.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.periods.manage": Object.freeze({ input: structuralOperationInput(["period"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.backfills.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.backfills.decide": Object.freeze({ input: structuralOperationInput(["backfillid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.policies.manage": Object.freeze({ input: structuralOperationInput(["policyid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
  "finance.policies.preview": Object.freeze({ input: structuralOperationInput(["policyid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.policies.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "finance.audit.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.profiles.manage": Object.freeze({ input: structuralOperationInput(["profileid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.profiles.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.operatorprofiles.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
<<<<<<< HEAD
=======
  "invoice.profiles.manage": Object.freeze({ input: structuralOperationInput(["profileid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.profiles.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  "invoice.profiles.manage": Object.freeze({ input: structuralOperationInput(["profileid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.profiles.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  "invoice.requests.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.requests.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.requests.cancel": Object.freeze({ input: structuralOperationInput(["requestid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.requests.decide": Object.freeze({ input: structuralOperationInput(["requestid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "invoice.requests.red": Object.freeze({ input: structuralOperationInput(["requestid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.cases.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.cases.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.cases.update": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.cases.close": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.cases.reopen": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.messages.send": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.messages.read": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.attachments.create": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.assignments.manage": Object.freeze({ input: structuralOperationInput(["assignmentid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.agents.manage": Object.freeze({ input: structuralOperationInput(["agentid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.agents.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.accounts.manage": Object.freeze({ input: structuralOperationInput(["accountid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.accounts.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.rules.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.rules.manage": Object.freeze({ input: structuralOperationInput(["ruleid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.slas.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.slas.manage": Object.freeze({ input: structuralOperationInput(["slaid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "support.history.read": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.notifications.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.preferences.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.preferences.manage": Object.freeze({ input: structuralOperationInput(["channel","eventtype"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.endpoints.manage": Object.freeze({ input: structuralOperationInput(["channel"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.templates.manage": Object.freeze({ input: structuralOperationInput(["templateid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.templates.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.announcements.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "notification.announcements.manage": Object.freeze({ input: structuralOperationInput(["announcementid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "risk.center.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "risk.policies.manage": Object.freeze({ input: structuralOperationInput(["policyid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "risk.cases.review": Object.freeze({ input: structuralOperationInput(["caseid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "audit.records.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "observability.clienterrors.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "observability.clienterrors.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.connections.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.connections.create": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.connections.update": Object.freeze({ input: structuralOperationInput(["connectionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.connections.test": Object.freeze({ input: structuralOperationInput(["connectionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.connections.enable": Object.freeze({ input: structuralOperationInput(["connectionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.connections.disable": Object.freeze({ input: structuralOperationInput(["connectionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.webhooks.receive": Object.freeze({ input: structuralOperationInput(["connectionid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.syncruns.start": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.syncruns.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.syncruns.cancel": Object.freeze({ input: structuralOperationInput(["runid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.operations.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "channel.operations.replay": Object.freeze({ input: structuralOperationInput(["operationid"] as const), output: structuralOperationOutput(), fidelity: "structural" }),
  "extension.installations.read": Object.freeze({ input: structuralOperationInput([] as const), output: structuralOperationOutput(), fidelity: "structural" }),
});

export type OperationInputFor<TKey extends OperationId> = SchemaOutput<(typeof OPERATION_SCHEMAS)[TKey]['input']>;
export type OperationOutputFor<TKey extends OperationId> = SchemaOutput<(typeof OPERATION_SCHEMAS)[TKey]['output']>;

export function operationSchema<TKey extends OperationId>(id: TKey): (typeof OPERATION_SCHEMAS)[TKey] {
  return OPERATION_SCHEMAS[id];
}
