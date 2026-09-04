// Generated from packages/contract/definitions/capabilities.yml. Do not edit.
export const CAPABILITY_CATALOG = Object.freeze([
  {
    "code": "surface.auth",
    "kind": "feature",
    "owner": "capability",
    "permission": null
  },
  {
    "code": "surface.console",
    "kind": "feature",
    "owner": "capability",
    "permission": null
  },
  {
    "code": "surface.storefront",
    "kind": "feature",
    "owner": "capability",
    "permission": null
  },
  {
    "code": "surface.miniapp",
    "kind": "feature",
    "owner": "capability",
    "permission": null
  },
  {
    "code": "surface.store",
    "kind": "feature",
    "owner": "capability",
    "permission": null
  },
  {
    "code": "surface.supplier",
    "kind": "feature",
    "owner": "capability",
    "permission": null
  },
  {
    "code": "approval.workflow",
    "kind": "feature",
    "owner": "approval",
    "permission": null,
    "dependencies": [
      "surface.console"
    ]
  },
  {
    "code": "voucher.lifecycle",
    "kind": "feature",
    "owner": "voucher",
    "permission": null
  },
  {
    "code": "runtime.importing",
    "kind": "feature",
    "owner": "runtime",
    "permission": null,
    "dependencies": [
      "surface.console"
    ]
  },
  {
    "code": "identity.federation",
    "kind": "entitlement",
    "owner": "identity",
    "permission": null
  },
  {
    "code": "identity.registration.reset",
    "kind": "entitlement",
    "owner": "identity",
    "permission": "identity.registration.reset"
  },
  {
    "code": "identity.directory",
    "kind": "entitlement",
    "owner": "organization",
    "permission": null
  },
  {
    "code": "approval.templates.create",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.template.manage",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.templates.revise",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.template.manage",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.templates.enable",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.template.manage",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.templates.disable",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.template.manage",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.templates.get",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.read",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.templates.list",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.read",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.tasks.list",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.read",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.tasks.approve",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.task.decide",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.tasks.reject",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.task.decide",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "approval.instances.get",
    "kind": "operation",
    "owner": "approval",
    "permission": "approval.read",
    "audience": "console",
    "dependencies": [
      "approval.workflow"
    ]
  },
  {
    "code": "navigation.tree.read",
    "kind": "operation",
    "owner": "navigation",
    "permission": null,
    "audience": "console"
  },
  {
    "code": "navigation.catalog.read",
    "kind": "operation",
    "owner": "navigation",
    "permission": "navigation.catalog.read",
    "audience": "console"
  },
  {
    "code": "navigation.health.read",
    "kind": "operation",
    "owner": "navigation",
    "permission": "runtime.health.read",
    "audience": "system"
  },
  {
    "code": "identity.bootstrap.read",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.providers.read",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.federations.start",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.federations.callback",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.federations.selection.read",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.federations.complete",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.links.read",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.link.read",
    "audience": "public"
  },
  {
    "code": "identity.links.create",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.link.manage",
    "audience": "public"
  },
  {
    "code": "identity.links.revoke",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.link.manage",
    "audience": "public"
  },
  {
    "code": "identity.providers.center.read",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.provider.manage",
    "audience": "console"
  },
  {
    "code": "identity.providers.manage",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.provider.manage",
    "audience": "console"
  },
  {
    "code": "identity.providers.test",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.provider.test",
    "audience": "console"
  },
  {
    "code": "organization.directories.read",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.directory.read",
    "audience": "console"
  },
  {
    "code": "organization.directories.manage",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.directory.manage",
    "audience": "console"
  },
  {
    "code": "organization.directories.sync",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.directory.sync",
    "audience": "console"
  },
  {
    "code": "organization.directories.syncruns.read",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.directory.read",
    "audience": "console"
  },
  {
    "code": "organization.directoryevents.receive",
    "kind": "operation",
    "owner": "organization",
    "permission": null,
    "audience": "webhook"
  },
  {
    "code": "runtime.health.live",
    "kind": "operation",
    "owner": "runtime",
    "permission": null,
    "audience": "system"
  },
  {
    "code": "runtime.health.ready",
    "kind": "operation",
    "owner": "runtime",
    "permission": null,
    "audience": "system"
  },
  {
    "code": "runtime.health.startup",
    "kind": "operation",
    "owner": "runtime",
    "permission": null,
    "audience": "system"
  },
  {
    "code": "runtime.health.dependency",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.health.read",
    "audience": "console"
  },
  {
    "code": "runtime.jobs.read",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.task.read",
    "audience": "console"
  },
  {
    "code": "runtime.jobs.cancel",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.task.manage",
    "audience": "console"
  },
  {
    "code": "runtime.uploads.create",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.import.manage",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "runtime.imports.create",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.import.manage",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "runtime.imports.read",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.task.read",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "runtime.imports.confirm",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.import.manage",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "runtime.imports.retry",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.task.manage",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "runtime.exports.read",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.task.read",
    "audience": "console"
  },
  {
    "code": "runtime.exports.cancel",
    "kind": "operation",
    "owner": "runtime",
    "permission": "runtime.task.manage",
    "audience": "console"
  },
  {
    "code": "identity.sessions.create",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.sessions.complete",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.tickets.exchange",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.session.read",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.session.read",
    "audience": "public"
  },
  {
    "code": "identity.session.delete",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.session.manage",
    "audience": "public"
  },
  {
    "code": "identity.sessions.read",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.session.read",
    "audience": "public"
  },
  {
    "code": "identity.sessions.revoke",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.session.manage",
    "audience": "public"
  },
  {
    "code": "identity.memberships.read",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.session.read",
    "audience": "public"
  },
  {
    "code": "identity.memberships.switch",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.session.manage",
    "audience": "public"
  },
  {
    "code": "identity.challenges.create",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.mobile.challenges.create",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.assurance.manage",
    "audience": "public"
  },
  {
    "code": "identity.invitations.read",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.invitation.read",
    "audience": "console"
  },
  {
    "code": "identity.invitations.resolve",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.invitations.create",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.invitation.issue",
    "audience": "console"
  },
  {
    "code": "identity.invitations.revoke",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.invitation.revoke",
    "audience": "console"
  },
  {
    "code": "identity.enrollments.read",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.enrollments.complete",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.members.manage",
    "kind": "operation",
    "owner": "identity",
    "permission": "member.manage",
    "audience": "console"
  },
  {
    "code": "identity.password.change",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.credential.manage",
    "audience": "public"
  },
  {
    "code": "identity.password.verify",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.assurance.manage",
    "audience": "public"
  },
  {
    "code": "identity.password.reset",
    "kind": "operation",
    "owner": "identity",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "identity.mobile.manage",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.mobile.manage",
    "audience": "public"
  },
  {
    "code": "identity.stepup.start",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.assurance.manage",
    "audience": "public"
  },
  {
    "code": "identity.stepup.complete",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.assurance.manage",
    "audience": "public"
  },
  {
    "code": "identity.stepup.disable",
    "kind": "operation",
    "owner": "identity",
    "permission": "identity.assurance.manage",
    "audience": "public"
  },
  {
    "code": "organization.layers.read",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.layer.read",
    "audience": "console"
  },
  {
    "code": "organization.malls.create",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.mall.manage",
    "audience": "console"
  },
  {
    "code": "organization.malls.read",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.mall.read",
    "audience": "console"
  },
  {
    "code": "organization.malls.update",
    "kind": "operation",
    "owner": "organization",
    "permission": "organization.mall.manage",
    "audience": "console"
  },
  {
    "code": "access.center.read",
    "kind": "operation",
    "owner": "access",
    "permission": "access.center.read",
    "audience": "console"
  },
  {
    "code": "access.ownership.read",
    "kind": "operation",
    "owner": "access",
    "permission": "access.ownership.read",
    "audience": "console"
  },
  {
    "code": "access.ownership.transfers.preview",
    "kind": "operation",
    "owner": "access",
    "permission": "access.ownership.transfer",
    "audience": "console"
  },
  {
    "code": "access.ownership.transfers.create",
    "kind": "operation",
    "owner": "access",
    "permission": "access.ownership.transfer",
    "audience": "console"
  },
  {
    "code": "access.ownership.transfers.accept.preview",
    "kind": "operation",
    "owner": "access",
    "permission": "access.ownership.accept",
    "audience": "console"
  },
  {
    "code": "access.ownership.transfers.accept",
    "kind": "operation",
    "owner": "access",
    "permission": "access.ownership.accept",
    "audience": "console"
  },
  {
    "code": "access.ownership.transfers.cancel.preview",
    "kind": "operation",
    "owner": "access",
    "permission": "access.ownership.transfer",
    "audience": "console"
  },
  {
    "code": "access.ownership.transfers.cancel",
    "kind": "operation",
    "owner": "access",
    "permission": "access.ownership.transfer",
    "audience": "console"
  },
  {
    "code": "access.overrides.manage",
    "kind": "operation",
    "owner": "access",
    "permission": "access.override.manage",
    "audience": "console"
  },
  {
    "code": "access.roles.manage",
    "kind": "operation",
    "owner": "access",
    "permission": "access.role.manage",
    "audience": "console"
  },
  {
    "code": "access.scopes.manage",
    "kind": "operation",
    "owner": "access",
    "permission": "access.scope.manage",
    "audience": "console"
  },
  {
    "code": "capability.assignments.read",
    "kind": "operation",
    "owner": "capability",
    "permission": "capability.assignment.read",
    "audience": "console"
  },
  {
    "code": "capability.assignments.manage",
    "kind": "operation",
    "owner": "capability",
    "permission": "capability.assignment.manage",
    "audience": "console"
  },
  {
    "code": "partner.partners.read",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.read",
    "audience": "console"
  },
  {
    "code": "partner.customers.create",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.customer.manage",
    "audience": "console"
  },
  {
    "code": "partner.customers.update",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.customer.manage",
    "audience": "console"
  },
  {
    "code": "partner.customers.enable",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.customer.manage",
    "audience": "console"
  },
  {
    "code": "partner.customers.disable",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.customer.manage",
    "audience": "console"
  },
  {
    "code": "partner.customers.get",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.customer.read",
    "audience": "console"
  },
  {
    "code": "partner.customers.list",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.customer.read",
    "audience": "console"
  },
  {
    "code": "partner.customeroptions.list",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.customer.read",
    "audience": "console"
  },
  {
    "code": "partner.partners.manage",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.manage",
    "audience": "console"
  },
  {
    "code": "organization.stores.read",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.read",
    "audience": "console"
  },
  {
    "code": "organization.stores.manage",
    "kind": "operation",
    "owner": "partner",
    "permission": "partner.manage",
    "audience": "console"
  },
  {
    "code": "member.members.read",
    "kind": "operation",
    "owner": "member",
    "permission": "member.read",
    "audience": "console"
  },
  {
    "code": "member.profile.read",
    "kind": "operation",
    "owner": "member",
    "permission": "member.profile.read",
    "audience": "public"
  },
  {
    "code": "member.addresses.read",
    "kind": "operation",
    "owner": "member",
    "permission": "member.address.read",
    "audience": "storefront"
  },
  {
    "code": "member.addresses.manage",
    "kind": "operation",
    "owner": "member",
    "permission": "member.address.manage",
    "audience": "storefront"
  },
  {
    "code": "member.favorites.read",
    "kind": "operation",
    "owner": "member",
    "permission": "member.favorite.read",
    "audience": "storefront"
  },
  {
    "code": "member.favorites.put",
    "kind": "operation",
    "owner": "member",
    "permission": "member.favorite.manage",
    "audience": "storefront"
  },
  {
    "code": "member.imports.create",
    "kind": "operation",
    "owner": "member",
    "permission": "member.import",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "member.imports.read",
    "kind": "operation",
    "owner": "member",
    "permission": "member.import",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "qualification.center.read",
    "kind": "operation",
    "owner": "qualification",
    "permission": "qualification.read",
    "audience": "console"
  },
  {
    "code": "qualification.decisions.preview",
    "kind": "operation",
    "owner": "qualification",
    "permission": "qualification.preview",
    "audience": "console"
  },
  {
    "code": "qualification.policies.manage",
    "kind": "operation",
    "owner": "qualification",
    "permission": "qualification.manage",
    "audience": "console"
  },
  {
    "code": "qualification.qualifications.publish",
    "kind": "operation",
    "owner": "qualification",
    "permission": "qualification.manage",
    "audience": "console",
    "dependencies": [
      "qualification.center.read"
    ]
  },
  {
    "code": "qualification.qualifications.revoke",
    "kind": "operation",
    "owner": "qualification",
    "permission": "qualification.manage",
    "audience": "console",
    "dependencies": [
      "qualification.center.read"
    ]
  },
  {
    "code": "qualification.evidenceuploads.create",
    "kind": "operation",
    "owner": "qualification",
    "permission": "qualification.manage",
    "audience": "console",
    "dependencies": [
      "qualification.center.read"
    ]
  },
  {
    "code": "channel.distributors.create",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.distributor.manage",
    "audience": "console"
  },
  {
    "code": "channel.distributors.read",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.distributor.read",
    "audience": "console"
  },
  {
    "code": "channel.distributors.update",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.distributor.manage",
    "audience": "console"
  },
  {
    "code": "channel.distributors.disable",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.distributor.manage",
    "audience": "console"
  },
  {
    "code": "channel.bindings.manage",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.binding.manage",
    "audience": "console"
  },
  {
    "code": "channel.quotas.manage",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.quota.manage",
    "audience": "console"
  },
  {
    "code": "catalog.pools.read",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.pool.read",
    "audience": "console"
  },
  {
    "code": "catalog.pools.attach",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.pool.manage",
    "audience": "console"
  },
  {
    "code": "catalog.pools.detach",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.pool.manage",
    "audience": "console"
  },
  {
    "code": "catalog.pools.allocate",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.pool.allocate",
    "audience": "console"
  },
  {
    "code": "catalog.listings.price.set",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.listing.manage",
    "audience": "console"
  },
  {
    "code": "catalog.listings.pool.set",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.listing.manage",
    "audience": "console"
  },
  {
    "code": "catalog.product.detail.read",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.product.read",
    "audience": "console"
  },
  {
    "code": "catalog.products.create",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.product.manage",
    "audience": "console"
  },
  {
    "code": "catalog.products.update",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.product.manage",
    "audience": "console"
  },
  {
    "code": "catalog.products.archive",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.product.manage",
    "audience": "console"
  },
  {
    "code": "catalog.listings.read",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.listing.read",
    "audience": "console"
  },
  {
    "code": "catalog.facets.read",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.listing.read",
    "audience": "console"
  },
  {
    "code": "catalog.listings.publish",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.listing.manage",
    "audience": "console"
  },
  {
    "code": "catalog.listings.unpublish",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.listing.manage",
    "audience": "console"
  },
  {
    "code": "catalog.listings.batch",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.listing.manage",
    "audience": "console"
  },
  {
    "code": "catalog.imports.create",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.import.manage",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "catalog.imports.read",
    "kind": "operation",
    "owner": "catalog",
    "permission": "catalog.import.read",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "pricing.rules.create",
    "kind": "operation",
    "owner": "pricing",
    "permission": "pricing.rule.manage",
    "audience": "console"
  },
  {
    "code": "pricing.rules.publish",
    "kind": "operation",
    "owner": "pricing",
    "permission": "pricing.rule.manage",
    "audience": "console"
  },
  {
    "code": "pricing.offers.read",
    "kind": "operation",
    "owner": "pricing",
    "permission": "pricing.offer.read",
    "audience": "public"
  },
  {
    "code": "inventory.availability.read",
    "kind": "operation",
    "owner": "inventory",
    "permission": "inventory.read",
    "audience": "public"
  },
  {
    "code": "inventory.imports.create",
    "kind": "operation",
    "owner": "inventory",
    "permission": "inventory.import.manage",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "inventory.imports.read",
    "kind": "operation",
    "owner": "inventory",
    "permission": "inventory.import.read",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "marketing.campaigns.read",
    "kind": "operation",
    "owner": "marketing",
    "permission": "marketing.read",
    "audience": "console"
  },
  {
    "code": "marketing.campaigns.create",
    "kind": "operation",
    "owner": "marketing",
    "permission": "marketing.manage",
    "audience": "console"
  },
  {
    "code": "marketing.campaigns.revise",
    "kind": "operation",
    "owner": "marketing",
    "permission": "marketing.manage",
    "audience": "console"
  },
  {
    "code": "marketing.campaigns.publish",
    "kind": "operation",
    "owner": "marketing",
    "permission": "marketing.manage",
    "audience": "console"
  },
  {
    "code": "marketing.campaigns.disable",
    "kind": "operation",
    "owner": "marketing",
    "permission": "marketing.manage",
    "audience": "console"
  },
  {
    "code": "reporting.dashboard.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.dashboard.read",
    "audience": "console"
  },
  {
    "code": "reporting.sales.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.sales.read",
    "audience": "console"
  },
  {
    "code": "reporting.products.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.product.read",
    "audience": "console"
  },
  {
    "code": "reporting.malls.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.mall.read",
    "audience": "console"
  },
  {
    "code": "reporting.categories.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.category.read",
    "audience": "console"
  },
  {
    "code": "reporting.channels.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.channel.read",
    "audience": "console"
  },
  {
    "code": "reporting.voucherconsumption.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.voucher.read",
    "audience": "console"
  },
  {
    "code": "reporting.exports.create",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.export.manage",
    "audience": "console"
  },
  {
    "code": "reporting.exports.read",
    "kind": "operation",
    "owner": "reporting",
    "permission": "reporting.export.read",
    "audience": "console"
  },
  {
    "code": "experience.applications.create",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.application.manage",
    "audience": "console"
  },
  {
    "code": "experience.applications.copy",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.application.manage",
    "audience": "console"
  },
  {
    "code": "experience.applications.detail.read",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.application.read",
    "audience": "console"
  },
  {
    "code": "experience.applications.read",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.application.read",
    "audience": "console"
  },
  {
    "code": "experience.applications.update",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.application.manage",
    "audience": "console"
  },
  {
    "code": "experience.versions.save",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.version.manage",
    "audience": "console"
  },
  {
    "code": "experience.versions.validate",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.version.manage",
    "audience": "console"
  },
  {
    "code": "experience.versions.publish",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.version.publish",
    "audience": "console"
  },
  {
    "code": "experience.versions.restore",
    "kind": "operation",
    "owner": "experience",
    "permission": "experience.version.publish",
    "audience": "console"
  },
  {
    "code": "experience.published.read",
    "kind": "operation",
    "owner": "experience",
    "permission": null,
    "audience": "public"
  },
  {
    "code": "cart.current.read",
    "kind": "operation",
    "owner": "cart",
    "permission": "cart.read",
    "audience": "storefront"
  },
  {
    "code": "cart.anonymous.merge",
    "kind": "operation",
    "owner": "cart",
    "permission": "cart.manage",
    "audience": "storefront"
  },
  {
    "code": "cart.items.put",
    "kind": "operation",
    "owner": "cart",
    "permission": "cart.manage",
    "audience": "storefront"
  },
  {
    "code": "cart.items.batch",
    "kind": "operation",
    "owner": "cart",
    "permission": "cart.manage",
    "audience": "storefront"
  },
  {
    "code": "checkout.quote.create",
    "kind": "operation",
    "owner": "checkout",
    "permission": "checkout.create",
    "audience": "storefront"
  },
  {
    "code": "order.orders.create",
    "kind": "operation",
    "owner": "order",
    "permission": "order.create",
    "audience": "storefront"
  },
  {
    "code": "order.orders.cancel",
    "kind": "operation",
    "owner": "order",
    "permission": "order.cancel",
    "audience": "public"
  },
  {
    "code": "order.orders.read",
    "kind": "operation",
    "owner": "order",
    "permission": "order.read",
    "audience": "public"
  },
  {
    "code": "order.detail.read",
    "kind": "operation",
    "owner": "order",
    "permission": "order.read",
    "audience": "public"
  },
  {
    "code": "order.reminders.create",
    "kind": "operation",
    "owner": "order",
    "permission": "order.reminder.create",
    "audience": "public"
  },
  {
    "code": "order.orders.export",
    "kind": "operation",
    "owner": "order",
    "permission": "order.export",
    "audience": "console"
  },
  {
    "code": "order.imports.create",
    "kind": "operation",
    "owner": "order",
    "permission": "order.import.manage",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "order.imports.read",
    "kind": "operation",
    "owner": "order",
    "permission": "order.import.read",
    "audience": "console",
    "dependencies": [
      "runtime.importing"
    ]
  },
  {
    "code": "order.aftersales.read",
    "kind": "operation",
    "owner": "order",
    "permission": "order.aftersale.read",
    "audience": "public"
  },
  {
    "code": "order.aftersales.apply",
    "kind": "operation",
    "owner": "order",
    "permission": "order.aftersale.apply",
    "audience": "storefront"
  },
  {
    "code": "order.aftersaleattachments.create",
    "kind": "operation",
    "owner": "order",
    "permission": "order.aftersale.apply",
    "audience": "storefront"
  },
  {
    "code": "order.aftersales.approve",
    "kind": "operation",
    "owner": "order",
    "permission": "order.aftersale.decide",
    "audience": "console"
  },
  {
    "code": "order.aftersales.reject",
    "kind": "operation",
    "owner": "order",
    "permission": "order.aftersale.decide",
    "audience": "console"
  },
  {
    "code": "fulfillment.shipments.create",
    "kind": "operation",
    "owner": "fulfillment",
    "permission": "fulfillment.ship",
    "audience": "console"
  },
  {
    "code": "fulfillment.tracking.read",
    "kind": "operation",
    "owner": "fulfillment",
    "permission": "fulfillment.read",
    "audience": "storefront"
  },
  {
    "code": "fulfillment.returns.receive",
    "kind": "operation",
    "owner": "fulfillment",
    "permission": "fulfillment.return.manage",
    "audience": "console"
  },
  {
    "code": "fulfillment.returns.inspect",
    "kind": "operation",
    "owner": "fulfillment",
    "permission": "fulfillment.return.manage",
    "audience": "console"
  },
  {
    "code": "payment.intents.create",
    "kind": "operation",
    "owner": "payment",
    "permission": "payment.create",
    "audience": "storefront"
  },
  {
    "code": "payment.intents.read",
    "kind": "operation",
    "owner": "payment",
    "permission": "payment.read",
    "audience": "storefront"
  },
  {
    "code": "verification.challenges.issue",
    "kind": "operation",
    "owner": "verification",
    "permission": "verification.issue",
    "audience": "console"
  },
  {
    "code": "verification.sessions.read",
    "kind": "operation",
    "owner": "verification",
    "permission": "verification.issue",
    "audience": "storefront"
  },
  {
    "code": "verification.challenges.verify",
    "kind": "operation",
    "owner": "verification",
    "permission": "verification.verify",
    "audience": "console"
  },
  {
    "code": "verification.history.read",
    "kind": "operation",
    "owner": "verification",
    "permission": "verification.verify",
    "audience": "console"
  },
  {
    "code": "verification.devices.read",
    "kind": "operation",
    "owner": "verification",
    "permission": "verification.verify",
    "audience": "console"
  },
  {
    "code": "verification.devices.manage",
    "kind": "operation",
    "owner": "verification",
    "permission": "verification.verify",
    "audience": "console"
  },
  {
    "code": "payment.refunds.request",
    "kind": "operation",
    "owner": "payment",
    "permission": "payment.refund",
    "audience": "console"
  },
  {
    "code": "payment.recoveries.read",
    "kind": "operation",
    "owner": "payment",
    "permission": "payment.recovery.read",
    "audience": "console"
  },
  {
    "code": "payment.recoveries.resolve",
    "kind": "operation",
    "owner": "payment",
    "permission": "payment.recovery.manage",
    "audience": "console"
  },
  {
    "code": "payment.webhooks.wechat",
    "kind": "operation",
    "owner": "payment",
    "permission": null,
    "audience": "webhook"
  },
  {
    "code": "voucher.products.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.product.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.products.revise",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.product.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.products.enable",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.product.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.products.disable",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.product.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.products.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.product.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.products.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.product.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.productoptions.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.product.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentialpools.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentials.generate",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentials.import",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "runtime.importing"
    ]
  },
  {
    "code": "voucher.credentialpools.close",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentialpools.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentialpools.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentials.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentials.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.credentialexports.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.credential.export",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.jobs.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.job.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.stockrequests.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.stockrequest.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.stockrequests.update",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.stockrequest.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.stockrequests.submit",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.stockrequest.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.stockrequests.cancel",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.stockrequest.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.stockrequests.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.stockrequest.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.stockrequests.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.stockrequest.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.stockrequestoptions.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.stockrequest.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.issueorders.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.issueorders.update",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.issueorders.submit",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.issueorders.cancel",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.issueorders.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.issueorders.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.issuebatches.retry",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.issuebatches.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.issue.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.issueorderexports.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.export.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.actionbatches.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.action.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.actionbatches.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.action.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.actionbatches.list",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.action.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.actionbatches.retry",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.action.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.actionexports.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.export.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.search.read",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.search.read",
    "audience": "public",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.activations.secret",
    "kind": "operation",
    "owner": "voucher",
    "permission": null,
    "audience": "public",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.activations.numbersecret",
    "kind": "operation",
    "owner": "voucher",
    "permission": null,
    "audience": "public",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.vouchers.bind",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.holder.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.vouchers.unbind",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.holder.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.vouchers.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.holder.read",
    "audience": "public",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.vouchers.getbynumber",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.search.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.vouchers.timeline",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.holder.read",
    "audience": "public",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.redemptions.quote",
    "kind": "operation",
    "owner": "voucher",
    "permission": "verification.verify",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.tenderholds.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "verification.verify",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.tenderholds.consume",
    "kind": "operation",
    "owner": "voucher",
    "permission": "verification.verify",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.tenderholds.release",
    "kind": "operation",
    "owner": "voucher",
    "permission": "verification.verify",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.redemptions.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "verification.verify",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.refunds.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.refund.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.redemptions.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.redemption.read",
    "audience": "public",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.searchfacets.read",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.search.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.searchsnapshots.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.search.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle"
    ]
  },
  {
    "code": "voucher.searchexports.create",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.export.manage",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "voucher.exports.get",
    "kind": "operation",
    "owner": "voucher",
    "permission": "voucher.export.read",
    "audience": "console",
    "dependencies": [
      "voucher.lifecycle",
      "approval.workflow"
    ]
  },
  {
    "code": "benefit.accounts.read",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.read",
    "audience": "storefront"
  },
  {
    "code": "benefit.ledgers.read",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.read",
    "audience": "storefront"
  },
  {
    "code": "benefit.plans.read",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.plan.read",
    "audience": "console"
  },
  {
    "code": "benefit.plans.manage",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.plan.manage",
    "audience": "console"
  },
  {
    "code": "benefit.budgets.read",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.budget.read",
    "audience": "console"
  },
  {
    "code": "benefit.budgets.manage",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.budget.manage",
    "audience": "console"
  },
  {
    "code": "benefit.grants.create",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.grant",
    "audience": "console"
  },
  {
    "code": "benefit.grants.decide",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.grant.decide",
    "audience": "console"
  },
  {
    "code": "benefit.grants.read",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.grant.read",
    "audience": "console"
  },
  {
    "code": "benefit.grants.control",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.grant.control",
    "audience": "console"
  },
  {
    "code": "benefit.grants.revoke",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.revoke",
    "audience": "console"
  },
  {
    "code": "benefit.lots.read",
    "kind": "operation",
    "owner": "benefit",
    "permission": "benefit.lot.read",
    "audience": "console"
  },
  {
    "code": "finance.overview.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.overview.read",
    "audience": "console"
  },
  {
    "code": "finance.facets.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.overview.read",
    "audience": "console"
  },
  {
    "code": "finance.audit.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "audit.read",
    "audience": "console"
  },
  {
    "code": "finance.entries.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.entry.read",
    "audience": "console"
  },
  {
    "code": "finance.statements.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.statement.read",
    "audience": "console"
  },
  {
    "code": "finance.statementimports.create",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.statement.import",
    "audience": "console"
  },
  {
    "code": "finance.statementimports.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.statement.read",
    "audience": "console"
  },
  {
    "code": "finance.statements.export",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.statement.export",
    "audience": "console"
  },
  {
    "code": "finance.reconciliations.manage",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.reconciliation.manage",
    "audience": "console"
  },
  {
    "code": "finance.reconciliations.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.reconciliation.read",
    "audience": "console"
  },
  {
    "code": "finance.settlements.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.settlement.read",
    "audience": "console"
  },
  {
    "code": "finance.settlements.decide",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.settlement.decide",
    "audience": "console"
  },
  {
    "code": "finance.settlements.adjust",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.settlement.adjust",
    "audience": "console"
  },
  {
    "code": "finance.withdrawals.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.withdrawal.read",
    "audience": "console"
  },
  {
    "code": "finance.withdrawals.create",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.withdrawal.create",
    "audience": "console"
  },
  {
    "code": "finance.withdrawals.decide",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.withdrawal.decide",
    "audience": "console"
  },
  {
    "code": "finance.withdrawals.recover",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.withdrawal.recover",
    "audience": "console"
  },
  {
    "code": "finance.holds.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.hold.read",
    "audience": "console"
  },
  {
    "code": "finance.periods.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.period.read",
    "audience": "console"
  },
  {
    "code": "finance.periods.manage",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.period.manage",
    "audience": "console"
  },
  {
    "code": "finance.backfills.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.backfill.read",
    "audience": "console"
  },
  {
    "code": "finance.backfills.decide",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.backfill.decide",
    "audience": "console"
  },
  {
    "code": "finance.policies.manage",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.policy.manage",
    "audience": "console"
  },
  {
    "code": "invoice.profiles.manage",
    "kind": "operation",
    "owner": "finance",
    "permission": "invoice.profile.manage",
    "audience": "console"
  },
  {
    "code": "invoice.profiles.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "invoice.profile.read",
    "audience": "storefront"
  },
  {
    "code": "invoice.requests.create",
    "kind": "operation",
    "owner": "finance",
    "permission": "invoice.request.create",
    "audience": "storefront"
  },
  {
    "code": "invoice.requests.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "invoice.request.read",
    "audience": "console"
  },
  {
    "code": "invoice.requests.cancel",
    "kind": "operation",
    "owner": "finance",
    "permission": "invoice.request.cancel",
    "audience": "console"
  },
  {
    "code": "invoice.requests.decide",
    "kind": "operation",
    "owner": "finance",
    "permission": "invoice.request.decide",
    "audience": "console"
  },
  {
    "code": "invoice.requests.red",
    "kind": "operation",
    "owner": "finance",
    "permission": "invoice.request.red",
    "audience": "console"
  },
  {
    "code": "finance.invoices.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.invoice.read",
    "audience": "storefront"
  },
  {
    "code": "finance.invoices.download",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.invoice.download",
    "audience": "storefront"
  },
  {
    "code": "support.cases.create",
    "kind": "operation",
    "owner": "support",
    "permission": "support.case.create",
    "audience": "storefront"
  },
  {
    "code": "support.cases.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.case.read",
    "audience": "public"
  },
  {
    "code": "support.cases.update",
    "kind": "operation",
    "owner": "support",
    "permission": "support.case.manage",
    "audience": "console"
  },
  {
    "code": "support.cases.close",
    "kind": "operation",
    "owner": "support",
    "permission": "support.case.manage",
    "audience": "console"
  },
  {
    "code": "support.cases.reopen",
    "kind": "operation",
    "owner": "support",
    "permission": "support.case.manage",
    "audience": "console"
  },
  {
    "code": "support.messages.send",
    "kind": "operation",
    "owner": "support",
    "permission": "support.message.send",
    "audience": "public"
  },
  {
    "code": "support.messages.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.message.read",
    "audience": "public"
  },
  {
    "code": "support.attachments.create",
    "kind": "operation",
    "owner": "support",
    "permission": "support.message.send",
    "audience": "public"
  },
  {
    "code": "support.assignments.manage",
    "kind": "operation",
    "owner": "support",
    "permission": "support.assignment.manage",
    "audience": "console"
  },
  {
    "code": "support.agents.manage",
    "kind": "operation",
    "owner": "support",
    "permission": "support.agent.manage",
    "audience": "console"
  },
  {
    "code": "support.agents.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.agent.read",
    "audience": "console"
  },
  {
    "code": "support.accounts.manage",
    "kind": "operation",
    "owner": "support",
    "permission": "support.account.manage",
    "audience": "console"
  },
  {
    "code": "support.accounts.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.account.read",
    "audience": "console"
  },
  {
    "code": "support.rules.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.rule.read",
    "audience": "console"
  },
  {
    "code": "support.rules.manage",
    "kind": "operation",
    "owner": "support",
    "permission": "support.rule.manage",
    "audience": "console"
  },
  {
    "code": "support.slas.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.sla.read",
    "audience": "console"
  },
  {
    "code": "support.slas.manage",
    "kind": "operation",
    "owner": "support",
    "permission": "support.sla.manage",
    "audience": "console"
  },
  {
    "code": "support.history.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.history.read",
    "audience": "console"
  },
  {
    "code": "support.events.read",
    "kind": "operation",
    "owner": "support",
    "permission": "support.event.read",
    "audience": "public"
  },
  {
    "code": "support.readstates.manage",
    "kind": "operation",
    "owner": "support",
    "permission": "support.readstate.manage",
    "audience": "public"
  },
  {
    "code": "notification.notifications.read",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.read",
    "audience": "storefront"
  },
  {
    "code": "notification.notifications.ack",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.ack",
    "audience": "storefront"
  },
  {
    "code": "notification.preferences.read",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.preference.read",
    "audience": "storefront"
  },
  {
    "code": "notification.preferences.manage",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.preference.manage",
    "audience": "storefront"
  },
  {
    "code": "notification.endpoints.manage",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.endpoint.manage",
    "audience": "storefront"
  },
  {
    "code": "notification.templates.manage",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.template.manage",
    "audience": "console"
  },
  {
    "code": "notification.templates.read",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.template.read",
    "audience": "console"
  },
  {
    "code": "notification.announcements.read",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.announcement.read",
    "audience": "console"
  },
  {
    "code": "notification.announcements.manage",
    "kind": "operation",
    "owner": "notification",
    "permission": "notification.announcement.manage",
    "audience": "console"
  },
  {
    "code": "risk.center.read",
    "kind": "operation",
    "owner": "risk",
    "permission": "risk.read",
    "audience": "console"
  },
  {
    "code": "risk.policies.manage",
    "kind": "operation",
    "owner": "risk",
    "permission": "risk.manage",
    "audience": "console"
  },
  {
    "code": "risk.cases.review",
    "kind": "operation",
    "owner": "risk",
    "permission": "risk.manage",
    "audience": "console"
  },
  {
    "code": "audit.records.read",
    "kind": "operation",
    "owner": "audit",
    "permission": "audit.read",
    "audience": "console"
  },
  {
    "code": "observability.clienterrors.create",
    "kind": "operation",
    "owner": "observability",
    "permission": "observability.clienterror.create",
    "audience": "storefront"
  },
  {
    "code": "observability.clienterrors.read",
    "kind": "operation",
    "owner": "observability",
    "permission": "observability.clienterror.read",
    "audience": "console"
  },
  {
    "code": "observability.healthoverview.read",
    "kind": "operation",
    "owner": "observability",
    "permission": "observability.health.read",
    "audience": "console"
  },
  {
    "code": "observability.slo.read",
    "kind": "operation",
    "owner": "observability",
    "permission": "observability.health.read",
    "audience": "console"
  },
  {
    "code": "channel.connections.read",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.connection.read",
    "audience": "console"
  },
  {
    "code": "channel.connections.create",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.connection.manage",
    "audience": "console"
  },
  {
    "code": "channel.connections.update",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.connection.manage",
    "audience": "console"
  },
  {
    "code": "channel.connections.test",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.connection.manage",
    "audience": "console"
  },
  {
    "code": "channel.connections.enable",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.connection.manage",
    "audience": "console"
  },
  {
    "code": "channel.connections.disable",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.connection.manage",
    "audience": "console"
  },
  {
    "code": "channel.webhooks.receive",
    "kind": "operation",
    "owner": "channel",
    "permission": null,
    "audience": "webhook"
  },
  {
    "code": "channel.syncruns.start",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.sync.manage",
    "audience": "console"
  },
  {
    "code": "channel.syncruns.read",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.sync.read",
    "audience": "console"
  },
  {
    "code": "channel.syncruns.cancel",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.sync.manage",
    "audience": "console"
  },
  {
    "code": "channel.operations.read",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.operation.read",
    "audience": "console"
  },
  {
    "code": "channel.operations.replay",
    "kind": "operation",
    "owner": "channel",
    "permission": "channel.operation.replay",
    "audience": "console"
  },
  {
    "code": "extension.installations.read",
    "kind": "operation",
    "owner": "extension",
    "permission": "extension.installation.read",
    "audience": "console"
  },
  {
    "code": "referral.settings.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.setting.read",
    "audience": "console"
  },
  {
    "code": "referral.settings.manage",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.setting.manage",
    "audience": "console"
  },
  {
    "code": "referral.products.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.product.read",
    "audience": "console"
  },
  {
    "code": "referral.products.manage",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.product.manage",
    "audience": "console"
  },
  {
    "code": "referral.members.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.member.read",
    "audience": "console"
  },
  {
    "code": "referral.members.apply",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.member.apply",
    "audience": "public"
  },
  {
    "code": "referral.members.approve",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.member.decide",
    "audience": "console"
  },
  {
    "code": "referral.members.disqualify",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.member.decide",
    "audience": "console"
  },
  {
    "code": "referral.bindings.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.binding.read",
    "audience": "public"
  },
  {
    "code": "referral.bindings.create",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.binding.create",
    "audience": "public"
  },
  {
    "code": "referral.commissions.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.commission.read",
    "audience": "console"
  },
  {
    "code": "referral.earnings.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.earning.readself",
    "audience": "public"
  },
  {
    "code": "referral.links.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.binding.read",
    "audience": "public"
  },
  {
    "code": "referral.withdrawals.read",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.withdrawal.readself",
    "audience": "public"
  },
  {
    "code": "referral.withdrawals.create",
    "kind": "operation",
    "owner": "referral",
    "permission": "referral.withdrawal.create",
    "audience": "public"
  },
  {
    "code": "finance.policies.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.policy.read",
    "audience": "console"
  },
  {
    "code": "finance.policies.preview",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.policy.preview",
    "audience": "console"
  },
  {
    "code": "finance.reconciliationrepairs.read",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.repair.read",
    "audience": "console"
  },
  {
    "code": "finance.reconciliationrepairs.preview",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.repair.preview",
    "audience": "console"
  },
  {
    "code": "finance.reconciliationrepairs.submit",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.repair.submit",
    "audience": "console"
  },
  {
    "code": "finance.reconciliationrepairs.decide",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.repair.decide",
    "audience": "console"
  },
  {
    "code": "finance.reconciliationrepairs.reverse",
    "kind": "operation",
    "owner": "finance",
    "permission": "finance.repair.reverse",
    "audience": "console"
  },
  {
    "code": "order.orders.receive",
    "kind": "operation",
    "owner": "order",
    "permission": "order.receive",
    "audience": "public"
  },
  {
    "code": "checkout.quotes.current.read",
    "kind": "operation",
    "owner": "checkout",
    "permission": "checkout.create",
    "audience": "storefront"
  },
  {
    "code": "storefront.bootstrap.read",
    "kind": "operation",
    "owner": "navigation",
    "permission": null,
    "audience": "storefront"
  },
  {
    "code": "storefront.catalog.read",
    "kind": "operation",
    "owner": "navigation",
    "permission": null,
    "audience": "storefront"
  }
] as const);
export type CapabilityCode = (typeof CAPABILITY_CATALOG)[number]['code'];
export const FEATURE_CAPABILITY_CODES = Object.freeze(["surface.auth","surface.console","surface.storefront","surface.miniapp","surface.store","surface.supplier","approval.workflow","voucher.lifecycle","runtime.importing"] as const);
export const CAPABILITY_CODES_BY_OWNER = Object.freeze({
  "access": Object.freeze(["access.center.read","access.ownership.read","access.ownership.transfers.preview","access.ownership.transfers.create","access.ownership.transfers.accept.preview","access.ownership.transfers.accept","access.ownership.transfers.cancel.preview","access.ownership.transfers.cancel","access.overrides.manage","access.roles.manage","access.scopes.manage"] as const),
  "approval": Object.freeze(["approval.workflow","approval.templates.create","approval.templates.revise","approval.templates.enable","approval.templates.disable","approval.templates.get","approval.templates.list","approval.tasks.list","approval.tasks.approve","approval.tasks.reject","approval.instances.get"] as const),
  "audit": Object.freeze(["audit.records.read"] as const),
  "benefit": Object.freeze(["benefit.accounts.read","benefit.ledgers.read","benefit.plans.read","benefit.plans.manage","benefit.budgets.read","benefit.budgets.manage","benefit.grants.create","benefit.grants.decide","benefit.grants.read","benefit.grants.control","benefit.grants.revoke","benefit.lots.read"] as const),
  "capability": Object.freeze(["surface.auth","surface.console","surface.storefront","surface.miniapp","surface.store","surface.supplier","capability.assignments.read","capability.assignments.manage"] as const),
  "cart": Object.freeze(["cart.current.read","cart.anonymous.merge","cart.items.put","cart.items.batch"] as const),
  "catalog": Object.freeze(["catalog.pools.read","catalog.pools.attach","catalog.pools.detach","catalog.pools.allocate","catalog.listings.price.set","catalog.listings.pool.set","catalog.product.detail.read","catalog.products.create","catalog.products.update","catalog.products.archive","catalog.listings.read","catalog.facets.read","catalog.listings.publish","catalog.listings.unpublish","catalog.listings.batch","catalog.imports.create","catalog.imports.read"] as const),
  "channel": Object.freeze(["channel.distributors.create","channel.distributors.read","channel.distributors.update","channel.distributors.disable","channel.bindings.manage","channel.quotas.manage","channel.connections.read","channel.connections.create","channel.connections.update","channel.connections.test","channel.connections.enable","channel.connections.disable","channel.webhooks.receive","channel.syncruns.start","channel.syncruns.read","channel.syncruns.cancel","channel.operations.read","channel.operations.replay"] as const),
  "checkout": Object.freeze(["checkout.quote.create","checkout.quotes.current.read"] as const),
  "experience": Object.freeze(["experience.applications.create","experience.applications.copy","experience.applications.detail.read","experience.applications.read","experience.applications.update","experience.versions.save","experience.versions.validate","experience.versions.publish","experience.versions.restore","experience.published.read"] as const),
  "extension": Object.freeze(["extension.installations.read"] as const),
  "finance": Object.freeze(["finance.overview.read","finance.facets.read","finance.audit.read","finance.entries.read","finance.statements.read","finance.statementimports.create","finance.statementimports.read","finance.statements.export","finance.reconciliations.manage","finance.reconciliations.read","finance.settlements.read","finance.settlements.decide","finance.settlements.adjust","finance.withdrawals.read","finance.withdrawals.create","finance.withdrawals.decide","finance.withdrawals.recover","finance.holds.read","finance.periods.read","finance.periods.manage","finance.backfills.read","finance.backfills.decide","finance.policies.manage","invoice.profiles.manage","invoice.profiles.read","invoice.requests.create","invoice.requests.read","invoice.requests.cancel","invoice.requests.decide","invoice.requests.red","finance.invoices.read","finance.invoices.download","finance.policies.read","finance.policies.preview","finance.reconciliationrepairs.read","finance.reconciliationrepairs.preview","finance.reconciliationrepairs.submit","finance.reconciliationrepairs.decide","finance.reconciliationrepairs.reverse"] as const),
  "fulfillment": Object.freeze(["fulfillment.shipments.create","fulfillment.tracking.read","fulfillment.returns.receive","fulfillment.returns.inspect"] as const),
  "identity": Object.freeze(["identity.federation","identity.registration.reset","identity.bootstrap.read","identity.providers.read","identity.federations.start","identity.federations.callback","identity.federations.selection.read","identity.federations.complete","identity.links.read","identity.links.create","identity.links.revoke","identity.providers.center.read","identity.providers.manage","identity.providers.test","identity.sessions.create","identity.sessions.complete","identity.tickets.exchange","identity.session.read","identity.session.delete","identity.sessions.read","identity.sessions.revoke","identity.memberships.read","identity.memberships.switch","identity.challenges.create","identity.mobile.challenges.create","identity.invitations.read","identity.invitations.resolve","identity.invitations.create","identity.invitations.revoke","identity.enrollments.read","identity.enrollments.complete","identity.members.manage","identity.password.change","identity.password.verify","identity.password.reset","identity.mobile.manage","identity.stepup.start","identity.stepup.complete","identity.stepup.disable"] as const),
  "inventory": Object.freeze(["inventory.availability.read","inventory.imports.create","inventory.imports.read"] as const),
  "marketing": Object.freeze(["marketing.campaigns.read","marketing.campaigns.create","marketing.campaigns.revise","marketing.campaigns.publish","marketing.campaigns.disable"] as const),
  "member": Object.freeze(["member.members.read","member.profile.read","member.addresses.read","member.addresses.manage","member.favorites.read","member.favorites.put","member.imports.create","member.imports.read"] as const),
  "navigation": Object.freeze(["navigation.tree.read","navigation.catalog.read","navigation.health.read","storefront.bootstrap.read","storefront.catalog.read"] as const),
  "notification": Object.freeze(["notification.notifications.read","notification.notifications.ack","notification.preferences.read","notification.preferences.manage","notification.endpoints.manage","notification.templates.manage","notification.templates.read","notification.announcements.read","notification.announcements.manage"] as const),
  "observability": Object.freeze(["observability.clienterrors.create","observability.clienterrors.read","observability.healthoverview.read","observability.slo.read"] as const),
  "order": Object.freeze(["order.orders.create","order.orders.cancel","order.orders.read","order.detail.read","order.reminders.create","order.orders.export","order.imports.create","order.imports.read","order.aftersales.read","order.aftersales.apply","order.aftersaleattachments.create","order.aftersales.approve","order.aftersales.reject","order.orders.receive"] as const),
  "organization": Object.freeze(["identity.directory","organization.directories.read","organization.directories.manage","organization.directories.sync","organization.directories.syncruns.read","organization.directoryevents.receive","organization.layers.read","organization.malls.create","organization.malls.read","organization.malls.update"] as const),
  "partner": Object.freeze(["partner.partners.read","partner.customers.create","partner.customers.update","partner.customers.enable","partner.customers.disable","partner.customers.get","partner.customers.list","partner.customeroptions.list","partner.partners.manage","organization.stores.read","organization.stores.manage"] as const),
  "payment": Object.freeze(["payment.intents.create","payment.intents.read","payment.refunds.request","payment.recoveries.read","payment.recoveries.resolve","payment.webhooks.wechat"] as const),
  "pricing": Object.freeze(["pricing.rules.create","pricing.rules.publish","pricing.offers.read"] as const),
  "qualification": Object.freeze(["qualification.center.read","qualification.decisions.preview","qualification.policies.manage","qualification.qualifications.publish","qualification.qualifications.revoke","qualification.evidenceuploads.create"] as const),
  "referral": Object.freeze(["referral.settings.read","referral.settings.manage","referral.products.read","referral.products.manage","referral.members.read","referral.members.apply","referral.members.approve","referral.members.disqualify","referral.bindings.read","referral.bindings.create","referral.commissions.read","referral.earnings.read","referral.links.read","referral.withdrawals.read","referral.withdrawals.create"] as const),
  "reporting": Object.freeze(["reporting.dashboard.read","reporting.sales.read","reporting.products.read","reporting.malls.read","reporting.categories.read","reporting.channels.read","reporting.voucherconsumption.read","reporting.exports.create","reporting.exports.read"] as const),
  "risk": Object.freeze(["risk.center.read","risk.policies.manage","risk.cases.review"] as const),
  "runtime": Object.freeze(["runtime.importing","runtime.health.live","runtime.health.ready","runtime.health.startup","runtime.health.dependency","runtime.jobs.read","runtime.jobs.cancel","runtime.uploads.create","runtime.imports.create","runtime.imports.read","runtime.imports.confirm","runtime.imports.retry","runtime.exports.read","runtime.exports.cancel"] as const),
  "support": Object.freeze(["support.cases.create","support.cases.read","support.cases.update","support.cases.close","support.cases.reopen","support.messages.send","support.messages.read","support.attachments.create","support.assignments.manage","support.agents.manage","support.agents.read","support.accounts.manage","support.accounts.read","support.rules.read","support.rules.manage","support.slas.read","support.slas.manage","support.history.read","support.events.read","support.readstates.manage"] as const),
  "verification": Object.freeze(["verification.challenges.issue","verification.sessions.read","verification.challenges.verify","verification.history.read","verification.devices.read","verification.devices.manage"] as const),
  "voucher": Object.freeze(["voucher.lifecycle","voucher.products.create","voucher.products.revise","voucher.products.enable","voucher.products.disable","voucher.products.get","voucher.products.list","voucher.productoptions.list","voucher.credentialpools.create","voucher.credentials.generate","voucher.credentials.import","voucher.credentialpools.close","voucher.credentialpools.get","voucher.credentialpools.list","voucher.credentials.list","voucher.credentials.get","voucher.credentialexports.create","voucher.jobs.get","voucher.stockrequests.create","voucher.stockrequests.update","voucher.stockrequests.submit","voucher.stockrequests.cancel","voucher.stockrequests.get","voucher.stockrequests.list","voucher.stockrequestoptions.list","voucher.issueorders.create","voucher.issueorders.update","voucher.issueorders.submit","voucher.issueorders.cancel","voucher.issueorders.get","voucher.issueorders.list","voucher.issuebatches.retry","voucher.issuebatches.get","voucher.issueorderexports.create","voucher.actionbatches.create","voucher.actionbatches.get","voucher.actionbatches.list","voucher.actionbatches.retry","voucher.actionexports.create","voucher.search.read","voucher.activations.secret","voucher.activations.numbersecret","voucher.vouchers.bind","voucher.vouchers.unbind","voucher.vouchers.get","voucher.vouchers.getbynumber","voucher.vouchers.timeline","voucher.redemptions.quote","voucher.tenderholds.create","voucher.tenderholds.consume","voucher.tenderholds.release","voucher.redemptions.create","voucher.refunds.create","voucher.redemptions.get","voucher.searchfacets.read","voucher.searchsnapshots.create","voucher.searchexports.create","voucher.exports.get"] as const),
});
export const OPERATION_CAPABILITY_CODES_BY_OWNER = Object.freeze({
  "access": Object.freeze(["access.center.read","access.ownership.read","access.ownership.transfers.preview","access.ownership.transfers.create","access.ownership.transfers.accept.preview","access.ownership.transfers.accept","access.ownership.transfers.cancel.preview","access.ownership.transfers.cancel","access.overrides.manage","access.roles.manage","access.scopes.manage"] as const),
  "approval": Object.freeze(["approval.templates.create","approval.templates.revise","approval.templates.enable","approval.templates.disable","approval.templates.get","approval.templates.list","approval.tasks.list","approval.tasks.approve","approval.tasks.reject","approval.instances.get"] as const),
  "audit": Object.freeze(["audit.records.read"] as const),
  "benefit": Object.freeze(["benefit.accounts.read","benefit.ledgers.read","benefit.plans.read","benefit.plans.manage","benefit.budgets.read","benefit.budgets.manage","benefit.grants.create","benefit.grants.decide","benefit.grants.read","benefit.grants.control","benefit.grants.revoke","benefit.lots.read"] as const),
  "capability": Object.freeze(["capability.assignments.read","capability.assignments.manage"] as const),
  "cart": Object.freeze(["cart.current.read","cart.anonymous.merge","cart.items.put","cart.items.batch"] as const),
  "catalog": Object.freeze(["catalog.pools.read","catalog.pools.attach","catalog.pools.detach","catalog.pools.allocate","catalog.listings.price.set","catalog.listings.pool.set","catalog.product.detail.read","catalog.products.create","catalog.products.update","catalog.products.archive","catalog.listings.read","catalog.facets.read","catalog.listings.publish","catalog.listings.unpublish","catalog.listings.batch","catalog.imports.create","catalog.imports.read"] as const),
  "channel": Object.freeze(["channel.distributors.create","channel.distributors.read","channel.distributors.update","channel.distributors.disable","channel.bindings.manage","channel.quotas.manage","channel.connections.read","channel.connections.create","channel.connections.update","channel.connections.test","channel.connections.enable","channel.connections.disable","channel.webhooks.receive","channel.syncruns.start","channel.syncruns.read","channel.syncruns.cancel","channel.operations.read","channel.operations.replay"] as const),
  "checkout": Object.freeze(["checkout.quote.create","checkout.quotes.current.read"] as const),
  "experience": Object.freeze(["experience.applications.create","experience.applications.copy","experience.applications.detail.read","experience.applications.read","experience.applications.update","experience.versions.save","experience.versions.validate","experience.versions.publish","experience.versions.restore","experience.published.read"] as const),
  "extension": Object.freeze(["extension.installations.read"] as const),
  "finance": Object.freeze(["finance.overview.read","finance.facets.read","finance.audit.read","finance.entries.read","finance.statements.read","finance.statementimports.create","finance.statementimports.read","finance.statements.export","finance.reconciliations.manage","finance.reconciliations.read","finance.settlements.read","finance.settlements.decide","finance.settlements.adjust","finance.withdrawals.read","finance.withdrawals.create","finance.withdrawals.decide","finance.withdrawals.recover","finance.holds.read","finance.periods.read","finance.periods.manage","finance.backfills.read","finance.backfills.decide","finance.policies.manage","invoice.profiles.manage","invoice.profiles.read","invoice.requests.create","invoice.requests.read","invoice.requests.cancel","invoice.requests.decide","invoice.requests.red","finance.invoices.read","finance.invoices.download","finance.policies.read","finance.policies.preview","finance.reconciliationrepairs.read","finance.reconciliationrepairs.preview","finance.reconciliationrepairs.submit","finance.reconciliationrepairs.decide","finance.reconciliationrepairs.reverse"] as const),
  "fulfillment": Object.freeze(["fulfillment.shipments.create","fulfillment.tracking.read","fulfillment.returns.receive","fulfillment.returns.inspect"] as const),
  "identity": Object.freeze(["identity.bootstrap.read","identity.providers.read","identity.federations.start","identity.federations.callback","identity.federations.selection.read","identity.federations.complete","identity.links.read","identity.links.create","identity.links.revoke","identity.providers.center.read","identity.providers.manage","identity.providers.test","identity.sessions.create","identity.sessions.complete","identity.tickets.exchange","identity.session.read","identity.session.delete","identity.sessions.read","identity.sessions.revoke","identity.memberships.read","identity.memberships.switch","identity.challenges.create","identity.mobile.challenges.create","identity.invitations.read","identity.invitations.resolve","identity.invitations.create","identity.invitations.revoke","identity.enrollments.read","identity.enrollments.complete","identity.members.manage","identity.password.change","identity.password.verify","identity.password.reset","identity.mobile.manage","identity.stepup.start","identity.stepup.complete","identity.stepup.disable"] as const),
  "inventory": Object.freeze(["inventory.availability.read","inventory.imports.create","inventory.imports.read"] as const),
  "marketing": Object.freeze(["marketing.campaigns.read","marketing.campaigns.create","marketing.campaigns.revise","marketing.campaigns.publish","marketing.campaigns.disable"] as const),
  "member": Object.freeze(["member.members.read","member.profile.read","member.addresses.read","member.addresses.manage","member.favorites.read","member.favorites.put","member.imports.create","member.imports.read"] as const),
  "navigation": Object.freeze(["navigation.tree.read","navigation.catalog.read","navigation.health.read","storefront.bootstrap.read","storefront.catalog.read"] as const),
  "notification": Object.freeze(["notification.notifications.read","notification.notifications.ack","notification.preferences.read","notification.preferences.manage","notification.endpoints.manage","notification.templates.manage","notification.templates.read","notification.announcements.read","notification.announcements.manage"] as const),
  "observability": Object.freeze(["observability.clienterrors.create","observability.clienterrors.read","observability.healthoverview.read","observability.slo.read"] as const),
  "order": Object.freeze(["order.orders.create","order.orders.cancel","order.orders.read","order.detail.read","order.reminders.create","order.orders.export","order.imports.create","order.imports.read","order.aftersales.read","order.aftersales.apply","order.aftersaleattachments.create","order.aftersales.approve","order.aftersales.reject","order.orders.receive"] as const),
  "organization": Object.freeze(["organization.directories.read","organization.directories.manage","organization.directories.sync","organization.directories.syncruns.read","organization.directoryevents.receive","organization.layers.read","organization.malls.create","organization.malls.read","organization.malls.update"] as const),
  "partner": Object.freeze(["partner.partners.read","partner.customers.create","partner.customers.update","partner.customers.enable","partner.customers.disable","partner.customers.get","partner.customers.list","partner.customeroptions.list","partner.partners.manage","organization.stores.read","organization.stores.manage"] as const),
  "payment": Object.freeze(["payment.intents.create","payment.intents.read","payment.refunds.request","payment.recoveries.read","payment.recoveries.resolve","payment.webhooks.wechat"] as const),
  "pricing": Object.freeze(["pricing.rules.create","pricing.rules.publish","pricing.offers.read"] as const),
  "qualification": Object.freeze(["qualification.center.read","qualification.decisions.preview","qualification.policies.manage","qualification.qualifications.publish","qualification.qualifications.revoke","qualification.evidenceuploads.create"] as const),
  "referral": Object.freeze(["referral.settings.read","referral.settings.manage","referral.products.read","referral.products.manage","referral.members.read","referral.members.apply","referral.members.approve","referral.members.disqualify","referral.bindings.read","referral.bindings.create","referral.commissions.read","referral.earnings.read","referral.links.read","referral.withdrawals.read","referral.withdrawals.create"] as const),
  "reporting": Object.freeze(["reporting.dashboard.read","reporting.sales.read","reporting.products.read","reporting.malls.read","reporting.categories.read","reporting.channels.read","reporting.voucherconsumption.read","reporting.exports.create","reporting.exports.read"] as const),
  "risk": Object.freeze(["risk.center.read","risk.policies.manage","risk.cases.review"] as const),
  "runtime": Object.freeze(["runtime.health.live","runtime.health.ready","runtime.health.startup","runtime.health.dependency","runtime.jobs.read","runtime.jobs.cancel","runtime.uploads.create","runtime.imports.create","runtime.imports.read","runtime.imports.confirm","runtime.imports.retry","runtime.exports.read","runtime.exports.cancel"] as const),
  "support": Object.freeze(["support.cases.create","support.cases.read","support.cases.update","support.cases.close","support.cases.reopen","support.messages.send","support.messages.read","support.attachments.create","support.assignments.manage","support.agents.manage","support.agents.read","support.accounts.manage","support.accounts.read","support.rules.read","support.rules.manage","support.slas.read","support.slas.manage","support.history.read","support.events.read","support.readstates.manage"] as const),
  "verification": Object.freeze(["verification.challenges.issue","verification.sessions.read","verification.challenges.verify","verification.history.read","verification.devices.read","verification.devices.manage"] as const),
  "voucher": Object.freeze(["voucher.products.create","voucher.products.revise","voucher.products.enable","voucher.products.disable","voucher.products.get","voucher.products.list","voucher.productoptions.list","voucher.credentialpools.create","voucher.credentials.generate","voucher.credentials.import","voucher.credentialpools.close","voucher.credentialpools.get","voucher.credentialpools.list","voucher.credentials.list","voucher.credentials.get","voucher.credentialexports.create","voucher.jobs.get","voucher.stockrequests.create","voucher.stockrequests.update","voucher.stockrequests.submit","voucher.stockrequests.cancel","voucher.stockrequests.get","voucher.stockrequests.list","voucher.stockrequestoptions.list","voucher.issueorders.create","voucher.issueorders.update","voucher.issueorders.submit","voucher.issueorders.cancel","voucher.issueorders.get","voucher.issueorders.list","voucher.issuebatches.retry","voucher.issuebatches.get","voucher.issueorderexports.create","voucher.actionbatches.create","voucher.actionbatches.get","voucher.actionbatches.list","voucher.actionbatches.retry","voucher.actionexports.create","voucher.search.read","voucher.activations.secret","voucher.activations.numbersecret","voucher.vouchers.bind","voucher.vouchers.unbind","voucher.vouchers.get","voucher.vouchers.getbynumber","voucher.vouchers.timeline","voucher.redemptions.quote","voucher.tenderholds.create","voucher.tenderholds.consume","voucher.tenderholds.release","voucher.redemptions.create","voucher.refunds.create","voucher.redemptions.get","voucher.searchfacets.read","voucher.searchsnapshots.create","voucher.searchexports.create","voucher.exports.get"] as const),
});
