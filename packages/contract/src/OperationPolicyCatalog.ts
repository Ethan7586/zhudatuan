// Generated from definitions/operations.yml. Do not edit.
import type { OperationId } from './OperationCatalog';

const POLICIES = [
  {
    "id": "runtime.health.live",
    "capability": "runtime.health.live",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "runtime.health.ready",
    "capability": "runtime.health.ready",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "runtime.health.startup",
    "capability": "runtime.health.startup",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "runtime.health.dependency",
    "capability": "runtime.health.dependency",
    "permission": "runtime.health.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.sessions.create",
    "capability": "identity.sessions.create",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.sessions.complete",
    "capability": "identity.sessions.complete",
    "permission": null,
    "assuranceLevel": "preauth",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.tickets.exchange",
    "capability": "identity.tickets.exchange",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.session.read",
    "capability": "identity.session.read",
    "permission": "identity.session.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.session.delete",
    "capability": "identity.session.delete",
    "permission": null,
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.sessions.read",
    "capability": "identity.sessions.read",
    "permission": "identity.session.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.sessions.revoke",
    "capability": "identity.sessions.revoke",
    "permission": "identity.session.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "identity.memberships.read",
    "capability": "identity.memberships.read",
    "permission": "identity.session.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.memberships.switch",
    "capability": "identity.memberships.switch",
    "permission": "identity.session.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.challenges.create",
    "capability": "identity.challenges.create",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.mobile.challenges.create",
    "capability": "identity.mobile.challenges.create",
    "permission": "identity.assurance.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.invitations.resolve",
    "capability": "identity.invitations.resolve",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.invitations.read",
    "capability": "identity.invitations.read",
    "permission": "identity.invitation.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.invitations.create",
    "capability": "identity.invitations.create",
    "permission": "identity.invitation.issue",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "identity.invitations.revoke",
    "capability": "identity.invitations.revoke",
    "permission": "identity.invitation.revoke",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "identity.enrollments.read",
    "capability": "identity.enrollments.read",
    "permission": null,
    "assuranceLevel": "preauth",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.enrollments.complete",
    "capability": "identity.enrollments.complete",
    "permission": null,
    "assuranceLevel": "preauth",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.members.manage",
    "capability": "identity.members.manage",
    "permission": "member.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "identity.password.change",
    "capability": "identity.password.change",
    "permission": "identity.credential.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "identity.password.verify",
    "capability": "identity.password.verify",
    "permission": "identity.assurance.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.password.reset",
    "capability": "identity.password.reset",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.mobile.manage",
    "capability": "identity.mobile.manage",
    "permission": "identity.mobile.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "identity.stepup.start",
    "capability": "identity.stepup.start",
    "permission": "identity.assurance.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.stepup.complete",
    "capability": "identity.stepup.complete",
    "permission": "identity.assurance.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.stepup.disable",
    "capability": "identity.stepup.disable",
    "permission": "identity.assurance.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "organization.layers.read",
    "capability": "organization.layers.read",
    "permission": "organization.layer.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "access.center.read",
    "capability": "access.center.read",
    "permission": "access.center.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "access.owners.transfer",
    "capability": "access.owners.transfer",
    "permission": "access.owner.transfer",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "access.roles.manage",
    "capability": "access.roles.manage",
    "permission": "access.role.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "access.overrides.manage",
    "capability": "access.overrides.manage",
    "permission": "access.override.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "access.scopes.manage",
    "capability": "access.scopes.manage",
    "permission": "access.scope.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "capability.assignments.read",
    "capability": "capability.assignments.read",
    "permission": "capability.assignment.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "capability.assignments.manage",
    "capability": "capability.assignments.manage",
    "permission": "capability.assignment.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "partner.partners.read",
    "capability": "partner.partners.read",
    "permission": "partner.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "partner.partners.manage",
    "capability": "partner.partners.manage",
    "permission": "partner.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "organization.stores.read",
    "capability": "organization.stores.read",
    "permission": "partner.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "organization.stores.manage",
    "capability": "organization.stores.manage",
    "permission": "partner.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "member.members.read",
    "capability": "member.members.read",
    "permission": "member.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "member.profile.read",
    "capability": "member.profile.read",
    "permission": "member.profile.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "member.addresses.read",
    "capability": "member.addresses.read",
    "permission": "member.address.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "member.addresses.manage",
    "capability": "member.addresses.manage",
    "permission": "member.address.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "member.favorites.read",
    "capability": "member.favorites.read",
    "permission": "member.favorite.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "member.favorites.put",
    "capability": "member.favorites.put",
    "permission": "member.favorite.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "member.imports.create",
    "capability": "member.imports.create",
    "permission": "member.import",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "member.imports.read",
    "capability": "member.imports.read",
    "permission": "member.import",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "qualification.center.read",
    "capability": "qualification.center.read",
    "permission": "qualification.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "qualification.decisions.preview",
    "capability": "qualification.decisions.preview",
    "permission": "qualification.preview",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "qualification.policies.manage",
    "capability": "qualification.policies.manage",
    "permission": "qualification.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.distributors.create",
    "capability": "channel.distributors.create",
    "permission": "channel.distributor.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.distributors.read",
    "capability": "channel.distributors.read",
    "permission": "channel.distributor.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.distributors.update",
    "capability": "channel.distributors.update",
    "permission": "channel.distributor.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.distributors.disable",
    "capability": "channel.distributors.disable",
    "permission": "channel.distributor.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.bindings.manage",
    "capability": "channel.bindings.manage",
    "permission": "channel.binding.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.quotas.manage",
    "capability": "channel.quotas.manage",
    "permission": "channel.quota.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "catalog.pools.read",
    "capability": "catalog.pools.read",
    "permission": "catalog.pool.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "catalog.pools.attach",
    "capability": "catalog.pools.attach",
    "permission": "catalog.pool.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "catalog.pools.detach",
    "capability": "catalog.pools.detach",
    "permission": "catalog.pool.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "catalog.pools.allocate",
    "capability": "catalog.pools.allocate",
    "permission": "catalog.pool.allocate",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "catalog.product.detail.read",
    "capability": "catalog.product.detail.read",
    "permission": "catalog.product.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "catalog.products.create",
    "capability": "catalog.products.create",
    "permission": "catalog.product.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "catalog.products.update",
    "capability": "catalog.products.update",
    "permission": "catalog.product.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "catalog.products.archive",
    "capability": "catalog.products.archive",
    "permission": "catalog.product.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "catalog.listings.read",
    "capability": "catalog.listings.read",
    "permission": "catalog.listing.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "catalog.listings.publish",
    "capability": "catalog.listings.publish",
    "permission": "catalog.listing.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "catalog.listings.unpublish",
    "capability": "catalog.listings.unpublish",
    "permission": "catalog.listing.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "catalog.listings.batch",
    "capability": "catalog.listings.batch",
    "permission": "catalog.listing.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "catalog.imports.create",
    "capability": "catalog.imports.create",
    "permission": "catalog.import.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "catalog.imports.read",
    "capability": "catalog.imports.read",
    "permission": "catalog.import.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "pricing.rules.create",
    "capability": "pricing.rules.create",
    "permission": "pricing.rule.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "pricing.rules.publish",
    "capability": "pricing.rules.publish",
    "permission": "pricing.rule.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "inventory.imports.create",
    "capability": "inventory.imports.create",
    "permission": "inventory.import.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "inventory.imports.read",
    "capability": "inventory.imports.read",
    "permission": "inventory.import.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "marketing.campaigns.read",
    "capability": "marketing.campaigns.read",
    "permission": "marketing.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.dashboard.read",
    "capability": "reporting.dashboard.read",
    "permission": "reporting.dashboard.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.sales.read",
    "capability": "reporting.sales.read",
    "permission": "reporting.sales.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.products.read",
    "capability": "reporting.products.read",
    "permission": "reporting.product.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.malls.read",
    "capability": "reporting.malls.read",
    "permission": "reporting.mall.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.categories.read",
    "capability": "reporting.categories.read",
    "permission": "reporting.category.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.channels.read",
    "capability": "reporting.channels.read",
    "permission": "reporting.channel.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.voucherconsumption.read",
    "capability": "reporting.voucherconsumption.read",
    "permission": "reporting.voucher.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.exports.create",
    "capability": "reporting.exports.create",
    "permission": "reporting.export.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "reporting.exports.read",
    "capability": "reporting.exports.read",
    "permission": "reporting.export.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "experience.applications.create",
    "capability": "experience.applications.create",
    "permission": "experience.application.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "experience.applications.copy",
    "capability": "experience.applications.copy",
    "permission": "experience.application.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "experience.applications.detail.read",
    "capability": "experience.applications.detail.read",
    "permission": "experience.application.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "experience.applications.read",
    "capability": "experience.applications.read",
    "permission": "experience.application.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "experience.applications.update",
    "capability": "experience.applications.update",
    "permission": "experience.application.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "experience.versions.save",
    "capability": "experience.versions.save",
    "permission": "experience.version.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "experience.versions.validate",
    "capability": "experience.versions.validate",
    "permission": "experience.version.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "experience.versions.publish",
    "capability": "experience.versions.publish",
    "permission": "experience.version.publish",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "experience.versions.restore",
    "capability": "experience.versions.restore",
    "permission": "experience.version.publish",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "cart.current.read",
    "capability": "cart.current.read",
    "permission": "cart.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "cart.items.put",
    "capability": "cart.items.put",
    "permission": "cart.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "cart.items.batch",
    "capability": "cart.items.batch",
    "permission": "cart.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "checkout.quote.create",
    "capability": "checkout.quote.create",
    "permission": "checkout.create",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.orders.create",
    "capability": "order.orders.create",
    "permission": "order.create",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.orders.read",
    "capability": "order.orders.read",
    "permission": "order.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.reminders.create",
    "capability": "order.reminders.create",
    "permission": "order.reminder.create",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.orders.export",
    "capability": "order.orders.export",
    "permission": "order.export",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.aftersales.read",
    "capability": "order.aftersales.read",
    "permission": "order.aftersale.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.aftersaleattachments.create",
    "capability": "order.aftersaleattachments.create",
    "permission": "order.aftersale.apply",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.aftersales.apply",
    "capability": "order.aftersales.apply",
    "permission": "order.aftersale.apply",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "order.aftersales.approve",
    "capability": "order.aftersales.approve",
    "permission": "order.aftersale.decide",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "order.aftersales.reject",
    "capability": "order.aftersales.reject",
    "permission": "order.aftersale.decide",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "fulfillment.shipments.create",
    "capability": "fulfillment.shipments.create",
    "permission": "fulfillment.ship",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "fulfillment.tracking.read",
    "capability": "fulfillment.tracking.read",
    "permission": "fulfillment.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "fulfillment.returns.receive",
    "capability": "fulfillment.returns.receive",
    "permission": "fulfillment.return.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "fulfillment.returns.inspect",
    "capability": "fulfillment.returns.inspect",
    "permission": "fulfillment.return.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "payment.intents.read",
    "capability": "payment.intents.read",
    "permission": "payment.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "verification.challenges.issue",
    "capability": "verification.challenges.issue",
    "permission": "verification.issue",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "verification.sessions.read",
    "capability": "verification.sessions.read",
    "permission": "verification.issue",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "verification.challenges.verify",
    "capability": "verification.challenges.verify",
    "permission": "verification.verify",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "verification.history.read",
    "capability": "verification.history.read",
    "permission": "verification.verify",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "verification.devices.read",
    "capability": "verification.devices.read",
    "permission": "verification.verify",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "verification.devices.manage",
    "capability": "verification.devices.manage",
    "permission": "verification.verify",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "payment.refunds.request",
    "capability": "payment.refunds.request",
    "permission": "payment.refund",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "payment.recoveries.read",
    "capability": "payment.recoveries.read",
    "permission": "payment.recovery.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "payment.recoveries.resolve",
    "capability": "payment.recoveries.resolve",
    "permission": "payment.recovery.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "payment.webhooks.wechat",
    "capability": "payment.webhooks.wechat",
    "permission": null,
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.cardlibraries.read",
    "capability": "voucher.cardlibraries.read",
    "permission": "voucher.cardlibrary.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.cardlibraries.create",
    "capability": "voucher.cardlibraries.create",
    "permission": "voucher.cardlibrary.create",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.cardlibraries.allocate",
    "capability": "voucher.cardlibraries.allocate",
    "permission": "voucher.cardlibrary.allocate",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "voucher.imports.read",
    "capability": "voucher.imports.read",
    "permission": "voucher.cardlibrary.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.programs.read",
    "capability": "voucher.programs.read",
    "permission": "voucher.program.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.programs.manage",
    "capability": "voucher.programs.manage",
    "permission": "voucher.program.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.reserves.read",
    "capability": "voucher.reserves.read",
    "permission": "voucher.reserve.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.reserves.request",
    "capability": "voucher.reserves.request",
    "permission": "voucher.reserve.request",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.reserves.decide",
    "capability": "voucher.reserves.decide",
    "permission": "voucher.reserve.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "voucher.batches.read",
    "capability": "voucher.batches.read",
    "permission": "voucher.batch.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.batches.issue",
    "capability": "voucher.batches.issue",
    "permission": "voucher.issue",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "voucher.batches.retry",
    "capability": "voucher.batches.retry",
    "permission": "voucher.issue",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "voucher.status.batch",
    "capability": "voucher.status.batch",
    "permission": "voucher.status.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "voucher.statusbatches.read",
    "capability": "voucher.statusbatches.read",
    "permission": "voucher.history.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.bindings.read",
    "capability": "voucher.bindings.read",
    "permission": "voucher.binding.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.bindings.manage",
    "capability": "voucher.bindings.manage",
    "permission": "voucher.binding.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "voucher.redemptions.read",
    "capability": "voucher.redemptions.read",
    "permission": "voucher.redemption.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.history.read",
    "capability": "voucher.history.read",
    "permission": "voucher.history.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "voucher.redemptions.reverse",
    "capability": "voucher.redemptions.reverse",
    "permission": "voucher.redemption.reverse",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "benefit.accounts.read",
    "capability": "benefit.accounts.read",
    "permission": "benefit.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "benefit.ledgers.read",
    "capability": "benefit.ledgers.read",
    "permission": "benefit.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "benefit.plans.read",
    "capability": "benefit.plans.read",
    "permission": "benefit.plan.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "benefit.plans.manage",
    "capability": "benefit.plans.manage",
    "permission": "benefit.plan.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "benefit.budgets.read",
    "capability": "benefit.budgets.read",
    "permission": "benefit.budget.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "benefit.budgets.manage",
    "capability": "benefit.budgets.manage",
    "permission": "benefit.budget.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "benefit.grants.create",
    "capability": "benefit.grants.create",
    "permission": "benefit.grant",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "benefit.grants.decide",
    "capability": "benefit.grants.decide",
    "permission": "benefit.grant.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "benefit.grants.read",
    "capability": "benefit.grants.read",
    "permission": "benefit.grant.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "benefit.grants.control",
    "capability": "benefit.grants.control",
    "permission": "benefit.grant.control",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "benefit.grants.revoke",
    "capability": "benefit.grants.revoke",
    "permission": "benefit.revoke",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "benefit.lots.read",
    "capability": "benefit.lots.read",
    "permission": "benefit.lot.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.overview.read",
    "capability": "finance.overview.read",
    "permission": "finance.overview.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.entries.read",
    "capability": "finance.entries.read",
    "permission": "finance.entry.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.statements.read",
    "capability": "finance.statements.read",
    "permission": "finance.statement.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.statements.export",
    "capability": "finance.statements.export",
    "permission": "finance.statement.export",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.reconciliations.manage",
    "capability": "finance.reconciliations.manage",
    "permission": "finance.reconciliation.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.reconciliations.read",
    "capability": "finance.reconciliations.read",
    "permission": "finance.reconciliation.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.settlements.read",
    "capability": "finance.settlements.read",
    "permission": "finance.settlement.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.settlements.decide",
    "capability": "finance.settlements.decide",
    "permission": "finance.settlement.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.settlements.adjust",
    "capability": "finance.settlements.adjust",
    "permission": "finance.settlement.adjust",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.withdrawals.read",
    "capability": "finance.withdrawals.read",
    "permission": "finance.withdrawal.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.withdrawals.create",
    "capability": "finance.withdrawals.create",
    "permission": "finance.withdrawal.create",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.withdrawals.decide",
    "capability": "finance.withdrawals.decide",
    "permission": "finance.withdrawal.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.withdrawals.recover",
    "capability": "finance.withdrawals.recover",
    "permission": "finance.withdrawal.recover",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.holds.read",
    "capability": "finance.holds.read",
    "permission": "finance.hold.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.periods.read",
    "capability": "finance.periods.read",
    "permission": "finance.period.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.periods.manage",
    "capability": "finance.periods.manage",
    "permission": "finance.period.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.backfills.read",
    "capability": "finance.backfills.read",
    "permission": "finance.backfill.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.backfills.decide",
    "capability": "finance.backfills.decide",
    "permission": "finance.backfill.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.policies.manage",
    "capability": "finance.policies.manage",
    "permission": "finance.policy.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.invoices.read",
    "capability": "finance.invoices.read",
    "permission": "finance.invoice.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.invoices.download",
    "capability": "finance.invoices.download",
    "permission": "finance.invoice.download",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "invoice.profiles.manage",
    "capability": "invoice.profiles.manage",
    "permission": "invoice.profile.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "invoice.profiles.read",
    "capability": "invoice.profiles.read",
    "permission": "invoice.profile.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "invoice.requests.create",
    "capability": "invoice.requests.create",
    "permission": "invoice.request.create",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "invoice.requests.read",
    "capability": "invoice.requests.read",
    "permission": "invoice.request.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "invoice.requests.cancel",
    "capability": "invoice.requests.cancel",
    "permission": "invoice.request.cancel",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "invoice.requests.decide",
    "capability": "invoice.requests.decide",
    "permission": "invoice.request.decide",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "invoice.requests.red",
    "capability": "invoice.requests.red",
    "permission": "invoice.request.red",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.cases.create",
    "capability": "support.cases.create",
    "permission": "support.case.create",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.cases.read",
    "capability": "support.cases.read",
    "permission": "support.case.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.cases.update",
    "capability": "support.cases.update",
    "permission": "support.case.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.cases.close",
    "capability": "support.cases.close",
    "permission": "support.case.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.cases.reopen",
    "capability": "support.cases.reopen",
    "permission": "support.case.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.messages.send",
    "capability": "support.messages.send",
    "permission": "support.message.send",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.messages.read",
    "capability": "support.messages.read",
    "permission": "support.message.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.attachments.create",
    "capability": "support.attachments.create",
    "permission": "support.message.send",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.assignments.manage",
    "capability": "support.assignments.manage",
    "permission": "support.assignment.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.agents.manage",
    "capability": "support.agents.manage",
    "permission": "support.agent.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.agents.read",
    "capability": "support.agents.read",
    "permission": "support.agent.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.accounts.manage",
    "capability": "support.accounts.manage",
    "permission": "support.account.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.accounts.read",
    "capability": "support.accounts.read",
    "permission": "support.account.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.rules.read",
    "capability": "support.rules.read",
    "permission": "support.rule.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.rules.manage",
    "capability": "support.rules.manage",
    "permission": "support.rule.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.slas.read",
    "capability": "support.slas.read",
    "permission": "support.sla.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.slas.manage",
    "capability": "support.slas.manage",
    "permission": "support.sla.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "support.history.read",
    "capability": "support.history.read",
    "permission": "support.history.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.events.read",
    "capability": "support.events.read",
    "permission": "support.event.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "support.readstates.manage",
    "capability": "support.readstates.manage",
    "permission": "support.readstate.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "notification.notifications.read",
    "capability": "notification.notifications.read",
    "permission": "notification.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "notification.notifications.ack",
    "capability": "notification.notifications.ack",
    "permission": "notification.ack",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "notification.preferences.read",
    "capability": "notification.preferences.read",
    "permission": "notification.preference.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "notification.preferences.manage",
    "capability": "notification.preferences.manage",
    "permission": "notification.preference.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "notification.endpoints.manage",
    "capability": "notification.endpoints.manage",
    "permission": "notification.endpoint.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "notification.templates.manage",
    "capability": "notification.templates.manage",
    "permission": "notification.template.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "notification.templates.read",
    "capability": "notification.templates.read",
    "permission": "notification.template.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "notification.announcements.read",
    "capability": "notification.announcements.read",
    "permission": "notification.announcement.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "notification.announcements.manage",
    "capability": "notification.announcements.manage",
    "permission": "notification.announcement.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "risk.center.read",
    "capability": "risk.center.read",
    "permission": "risk.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "risk.policies.manage",
    "capability": "risk.policies.manage",
    "permission": "risk.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "risk.cases.review",
    "capability": "risk.cases.review",
    "permission": "risk.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "audit.records.read",
    "capability": "audit.records.read",
    "permission": "audit.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "observability.clienterrors.create",
    "capability": "observability.clienterrors.create",
    "permission": "observability.clienterror.create",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "observability.clienterrors.read",
    "capability": "observability.clienterrors.read",
    "permission": "observability.clienterror.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.connections.read",
    "capability": "channel.connections.read",
    "permission": "channel.connection.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.connections.create",
    "capability": "channel.connections.create",
    "permission": "channel.connection.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.connections.update",
    "capability": "channel.connections.update",
    "permission": "channel.connection.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.connections.test",
    "capability": "channel.connections.test",
    "permission": "channel.connection.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.connections.enable",
    "capability": "channel.connections.enable",
    "permission": "channel.connection.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.connections.disable",
    "capability": "channel.connections.disable",
    "permission": "channel.connection.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.webhooks.receive",
    "capability": "channel.webhooks.receive",
    "permission": null,
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.syncruns.start",
    "capability": "channel.syncruns.start",
    "permission": "channel.sync.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.syncruns.read",
    "capability": "channel.syncruns.read",
    "permission": "channel.sync.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.syncruns.cancel",
    "capability": "channel.syncruns.cancel",
    "permission": "channel.sync.manage",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "channel.operations.read",
    "capability": "channel.operations.read",
    "permission": "channel.operation.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "channel.operations.replay",
    "capability": "channel.operations.replay",
    "permission": "channel.operation.replay",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "extension.installations.read",
    "capability": "extension.installations.read",
    "permission": "extension.installation.read",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "navigation.tree.read",
    "capability": "navigation.tree.read",
    "permission": null,
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "navigation.catalog.read",
    "capability": "navigation.catalog.read",
    "permission": "navigation.catalog.read",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "navigation.health.read",
    "capability": "navigation.health.read",
    "permission": "runtime.health.read",
    "assuranceLevel": "service",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.bootstrap.read",
    "capability": "identity.bootstrap.read",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.providers.read",
    "capability": "identity.providers.read",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.federations.start",
    "capability": "identity.federations.start",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.federations.callback",
    "capability": "identity.federations.callback",
    "permission": null,
    "assuranceLevel": "anonymous",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.federations.selection.read",
    "capability": "identity.federations.selection.read",
    "permission": null,
    "assuranceLevel": "preauth",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.federations.complete",
    "capability": "identity.federations.complete",
    "permission": null,
    "assuranceLevel": "preauth",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.links.read",
    "capability": "identity.links.read",
    "permission": "identity.link.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.links.create",
    "capability": "identity.links.create",
    "permission": "identity.link.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.links.revoke",
    "capability": "identity.links.revoke",
    "permission": "identity.link.manage",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.providers.center.read",
    "capability": "identity.providers.center.read",
    "permission": "identity.provider.manage",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "identity.providers.manage",
    "capability": "identity.providers.manage",
    "permission": "identity.provider.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "identity.providers.test",
    "capability": "identity.providers.test",
    "permission": "identity.provider.test",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "organization.directories.read",
    "capability": "organization.directories.read",
    "permission": "organization.directory.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "organization.directories.manage",
    "capability": "organization.directories.manage",
    "permission": "organization.directory.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "organization.directories.sync",
    "capability": "organization.directories.sync",
    "permission": "organization.directory.sync",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "organization.directories.syncruns.read",
    "capability": "organization.directories.syncruns.read",
    "permission": "organization.directory.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "organization.directoryevents.receive",
    "capability": "organization.directoryevents.receive",
    "permission": null,
    "assuranceLevel": "signed",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.settings.read",
    "capability": "referral.settings.read",
    "permission": "referral.setting.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.settings.manage",
    "capability": "referral.settings.manage",
    "permission": "referral.setting.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "referral.products.read",
    "capability": "referral.products.read",
    "permission": "referral.product.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.products.manage",
    "capability": "referral.products.manage",
    "permission": "referral.product.manage",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "referral.members.read",
    "capability": "referral.members.read",
    "permission": "referral.member.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.members.apply",
    "capability": "referral.members.apply",
    "permission": "referral.member.apply",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.members.approve",
    "capability": "referral.members.approve",
    "permission": "referral.member.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "referral.members.disqualify",
    "capability": "referral.members.disqualify",
    "permission": "referral.member.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "referral.bindings.read",
    "capability": "referral.bindings.read",
    "permission": "referral.binding.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.bindings.create",
    "capability": "referral.bindings.create",
    "permission": "referral.binding.create",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.commissions.read",
    "capability": "referral.commissions.read",
    "permission": "referral.commission.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.earnings.read",
    "capability": "referral.earnings.read",
    "permission": "referral.earning.readself",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.links.read",
    "capability": "referral.links.read",
    "permission": "referral.binding.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.withdrawals.read",
    "capability": "referral.withdrawals.read",
    "permission": "referral.withdrawal.readself",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "referral.withdrawals.create",
    "capability": "referral.withdrawals.create",
    "permission": "referral.withdrawal.create",
    "assuranceLevel": "stepup",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "finance.policies.read",
    "capability": "finance.policies.read",
    "permission": "finance.policy.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.policies.preview",
    "capability": "finance.policies.preview",
    "permission": "finance.policy.preview",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "finance.reconciliationrepairs.read",
    "capability": "finance.reconciliationrepairs.read",
    "permission": "finance.repair.read",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "finance.reconciliationrepairs.preview",
    "capability": "finance.reconciliationrepairs.preview",
    "permission": "finance.repair.preview",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "finance.reconciliationrepairs.submit",
    "capability": "finance.reconciliationrepairs.submit",
    "permission": "finance.repair.submit",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.reconciliationrepairs.decide",
    "capability": "finance.reconciliationrepairs.decide",
    "permission": "finance.repair.decide",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "finance.reconciliationrepairs.reverse",
    "capability": "finance.reconciliationrepairs.reverse",
    "permission": "finance.repair.reverse",
    "assuranceLevel": "stepup",
    "makerChecker": true,
    "expectedVersion": "required",
    "actionProof": true
  },
  {
    "id": "order.orders.receive",
    "capability": "order.orders.receive",
    "permission": "order.receive",
    "assuranceLevel": "mfa",
    "makerChecker": false,
    "expectedVersion": "required",
    "actionProof": false
  },
  {
    "id": "checkout.quotes.current.read",
    "capability": "checkout.quotes.current.read",
    "permission": "checkout.create",
    "assuranceLevel": "session",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "storefront.bootstrap.read",
    "capability": "storefront.bootstrap.read",
    "permission": null,
    "assuranceLevel": "optional",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  },
  {
    "id": "storefront.catalog.read",
    "capability": "storefront.catalog.read",
    "permission": null,
    "assuranceLevel": "optional",
    "makerChecker": false,
    "expectedVersion": "none",
    "actionProof": false
  }
] as const;
export type ClientOperationPolicy = typeof POLICIES[number];
const BY_ID: ReadonlyMap<string, ClientOperationPolicy> = new Map(POLICIES.map((policy) => [policy.id, policy]));
export function operationPolicy(id: OperationId): ClientOperationPolicy { const policy = BY_ID.get(id); if (!policy) throw new Error('OPERATION_UNKNOWN'); return policy; }
