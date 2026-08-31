// Generated from packages/contract/definitions/permissions.yml. Do not edit.
import type { PermissionDefinition } from './Permission';

export const PERMISSION_CATALOG = Object.freeze([
  {
    "code": "access.center.read",
    "module": "access",
    "category": "access",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "access.center.read"
  },
  {
    "code": "access.membership.activate",
    "module": "access",
    "category": "access",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "access.membership.activate"
  },
  {
    "code": "access.override.manage",
    "module": "access",
    "category": "access",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "access.override.manage"
  },
  {
    "code": "access.owner.transfer",
    "module": "access",
    "category": "access",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": false,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "access.owner.transfer"
  },
  {
    "code": "access.role.delegate",
    "module": "access",
    "category": "access",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "access.role.delegate"
  },
  {
    "code": "access.role.manage",
    "module": "access",
    "category": "access",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "access.role.manage"
  },
  {
    "code": "access.scope.delegate",
    "module": "access",
    "category": "access",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "access.scope.delegate"
  },
  {
    "code": "access.scope.manage",
    "module": "access",
    "category": "access",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "access.scope.manage"
  },
  {
    "code": "audit.read",
    "module": "audit",
    "category": "audit",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "audit.read"
  },
  {
    "code": "benefit.budget.manage",
    "module": "benefit",
    "category": "benefit",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "benefit.budget.manage"
  },
  {
    "code": "benefit.budget.read",
    "module": "benefit",
    "category": "benefit",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "benefit.budget.read"
  },
  {
    "code": "benefit.grant",
    "module": "benefit",
    "category": "benefit",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "benefit.grant"
  },
  {
    "code": "benefit.grant.control",
    "module": "benefit",
    "category": "benefit",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "benefit.grant.control"
  },
  {
    "code": "benefit.grant.decide",
    "module": "benefit",
    "category": "benefit",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "benefit.grant.decide"
  },
  {
    "code": "benefit.grant.read",
    "module": "benefit",
    "category": "benefit",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "benefit.grant.read"
  },
  {
    "code": "benefit.lot.read",
    "module": "benefit",
    "category": "benefit",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "benefit.lot.read"
  },
  {
    "code": "benefit.plan.manage",
    "module": "benefit",
    "category": "benefit",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "benefit.plan.manage"
  },
  {
    "code": "benefit.plan.read",
    "module": "benefit",
    "category": "benefit",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "benefit.plan.read"
  },
  {
    "code": "benefit.read",
    "module": "benefit",
    "category": "benefit",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "benefit.read"
  },
  {
    "code": "benefit.revoke",
    "module": "benefit",
    "category": "benefit",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "benefit.revoke"
  },
  {
    "code": "capability.assignment.manage",
    "module": "capability",
    "category": "capability",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "capability.assignment.manage"
  },
  {
    "code": "capability.assignment.read",
    "module": "capability",
    "category": "capability",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "capability.assignment.read"
  },
  {
    "code": "cart.manage",
    "module": "cart",
    "category": "cart",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "cart.manage"
  },
  {
    "code": "cart.read",
    "module": "cart",
    "category": "cart",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "cart.read"
  },
  {
    "code": "catalog.import.manage",
    "module": "catalog",
    "category": "catalog",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "catalog.import.manage"
  },
  {
    "code": "catalog.import.read",
    "module": "catalog",
    "category": "catalog",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "catalog.import.read"
  },
  {
    "code": "catalog.listing.manage",
    "module": "catalog",
    "category": "catalog",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "catalog.listing.manage"
  },
  {
    "code": "catalog.listing.read",
    "module": "catalog",
    "category": "catalog",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "catalog.listing.read"
  },
  {
    "code": "catalog.pool.allocate",
    "module": "catalog",
    "category": "catalog",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "catalog.pool.allocate"
  },
  {
    "code": "catalog.pool.manage",
    "module": "catalog",
    "category": "catalog",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "catalog.pool.manage"
  },
  {
    "code": "catalog.pool.read",
    "module": "catalog",
    "category": "catalog",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "catalog.pool.read"
  },
  {
    "code": "catalog.product.manage",
    "module": "catalog",
    "category": "catalog",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "catalog.product.manage"
  },
  {
    "code": "catalog.product.read",
    "module": "catalog",
    "category": "catalog",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "catalog.product.read"
  },
  {
    "code": "channel.binding.manage",
    "module": "channel",
    "category": "channel",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.binding.manage"
  },
  {
    "code": "channel.connection.manage",
    "module": "channel",
    "category": "channel",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.connection.manage"
  },
  {
    "code": "channel.connection.read",
    "module": "channel",
    "category": "channel",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.connection.read"
  },
  {
    "code": "channel.distributor.manage",
    "module": "channel",
    "category": "channel",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform"
    ],
    "makerChecker": false,
    "description": "channel.distributor.manage"
  },
  {
    "code": "channel.distributor.read",
    "module": "channel",
    "category": "channel",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.distributor.read"
  },
  {
    "code": "channel.operation.read",
    "module": "channel",
    "category": "channel",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.operation.read"
  },
  {
    "code": "channel.operation.replay",
    "module": "channel",
    "category": "channel",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.operation.replay"
  },
  {
    "code": "channel.quota.manage",
    "module": "channel",
    "category": "channel",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.quota.manage"
  },
  {
    "code": "channel.sync.manage",
    "module": "channel",
    "category": "channel",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.sync.manage"
  },
  {
    "code": "channel.sync.read",
    "module": "channel",
    "category": "channel",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "channel.sync.read"
  },
  {
    "code": "checkout.create",
    "module": "checkout",
    "category": "checkout",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "checkout.create"
  },
  {
    "code": "experience.application.manage",
    "module": "experience",
    "category": "experience",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "experience.application.manage"
  },
  {
    "code": "experience.application.read",
    "module": "experience",
    "category": "experience",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "experience.application.read"
  },
  {
    "code": "experience.version.manage",
    "module": "experience",
    "category": "experience",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "experience.version.manage"
  },
  {
    "code": "experience.version.publish",
    "module": "experience",
    "category": "experience",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "experience.version.publish"
  },
  {
    "code": "extension.installation.read",
    "module": "extension",
    "category": "extension",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform"
    ],
    "makerChecker": false,
    "description": "extension.installation.read"
  },
  {
    "code": "finance.backfill.decide",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.backfill.decide"
  },
  {
    "code": "finance.backfill.read",
    "module": "finance",
    "category": "finance",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.backfill.read"
  },
  {
    "code": "finance.entry.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.entry.read"
  },
  {
    "code": "finance.hold.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.hold.read"
  },
  {
    "code": "finance.invoice.download",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "finance.invoice.download"
  },
  {
    "code": "finance.invoice.read",
    "module": "finance",
    "category": "finance",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "finance.invoice.read"
  },
  {
    "code": "finance.overview.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.overview.read"
  },
  {
    "code": "finance.period.manage",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.period.manage"
  },
  {
    "code": "finance.period.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.period.read"
  },
  {
    "code": "finance.policy.manage",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.policy.manage"
  },
  {
    "code": "finance.policy.preview",
    "module": "finance",
    "category": "finance",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.policy.preview"
  },
  {
    "code": "finance.policy.read",
    "module": "finance",
    "category": "finance",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.policy.read"
  },
  {
    "code": "finance.reconciliation.manage",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.reconciliation.manage"
  },
  {
    "code": "finance.reconciliation.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.reconciliation.read"
  },
  {
    "code": "finance.repair.decide",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.repair.decide"
  },
  {
    "code": "finance.repair.preview",
    "module": "finance",
    "category": "finance",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.repair.preview"
  },
  {
    "code": "finance.repair.read",
    "module": "finance",
    "category": "finance",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.repair.read"
  },
  {
    "code": "finance.repair.reverse",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.repair.reverse"
  },
  {
    "code": "finance.repair.submit",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.repair.submit"
  },
  {
    "code": "finance.settlement.adjust",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.settlement.adjust"
  },
  {
    "code": "finance.settlement.decide",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.settlement.decide"
  },
  {
    "code": "finance.settlement.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.settlement.read"
  },
  {
    "code": "finance.statement.export",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.statement.export"
  },
  {
    "code": "finance.statement.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.statement.read"
  },
  {
    "code": "finance.withdrawal.create",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.withdrawal.create"
  },
  {
    "code": "finance.withdrawal.decide",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.withdrawal.decide"
  },
  {
    "code": "finance.withdrawal.read",
    "module": "finance",
    "category": "finance",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "finance.withdrawal.read"
  },
  {
    "code": "finance.withdrawal.recover",
    "module": "finance",
    "category": "finance",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "finance.withdrawal.recover"
  },
  {
    "code": "fulfillment.read",
    "module": "fulfillment",
    "category": "fulfillment",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "fulfillment.read"
  },
  {
    "code": "fulfillment.return.manage",
    "module": "fulfillment",
    "category": "fulfillment",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "fulfillment.return.manage"
  },
  {
    "code": "fulfillment.ship",
    "module": "fulfillment",
    "category": "fulfillment",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "fulfillment.ship"
  },
  {
    "code": "identity.assurance.manage",
    "module": "identity",
    "category": "identity",
    "risk": "elevated",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "self"
    ],
    "makerChecker": false,
    "description": "identity.assurance.manage"
  },
  {
    "code": "identity.credential.manage",
    "module": "identity",
    "category": "identity",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": false,
    "allowedScopeKinds": [
      "self"
    ],
    "makerChecker": false,
    "description": "identity.credential.manage"
  },
  {
    "code": "identity.invitation.audit",
    "module": "identity",
    "category": "identity",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "identity.invitation.audit"
  },
  {
    "code": "identity.invitation.issue",
    "module": "identity",
    "category": "identity",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "identity.invitation.issue"
  },
  {
    "code": "identity.invitation.read",
    "module": "identity",
    "category": "identity",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "identity.invitation.read"
  },
  {
    "code": "identity.invitation.revoke",
    "module": "identity",
    "category": "identity",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "identity.invitation.revoke"
  },
  {
    "code": "identity.link.manage",
    "module": "identity",
    "category": "identity",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": false,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "identity.link.manage"
  },
  {
    "code": "identity.link.read",
    "module": "identity",
    "category": "identity",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "identity.link.read"
  },
  {
    "code": "identity.mobile.manage",
    "module": "identity",
    "category": "identity",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "self"
    ],
    "makerChecker": false,
    "description": "identity.mobile.manage"
  },
  {
    "code": "identity.provider.manage",
    "module": "identity",
    "category": "identity",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "identity.provider.manage"
  },
  {
    "code": "identity.provider.test",
    "module": "identity",
    "category": "identity",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "identity.provider.test"
  },
  {
    "code": "identity.session.manage",
    "module": "identity",
    "category": "identity",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "self"
    ],
    "makerChecker": false,
    "description": "identity.session.manage"
  },
  {
    "code": "identity.session.read",
    "module": "identity",
    "category": "identity",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "self"
    ],
    "makerChecker": false,
    "description": "identity.session.read"
  },
  {
    "code": "inventory.import.manage",
    "module": "inventory",
    "category": "inventory",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "inventory.import.manage"
  },
  {
    "code": "inventory.import.read",
    "module": "inventory",
    "category": "inventory",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "inventory.import.read"
  },
  {
    "code": "inventory.read",
    "module": "inventory",
    "category": "inventory",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "inventory.read"
  },
  {
    "code": "invoice.profile.manage",
    "module": "invoice",
    "category": "invoice",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "invoice.profile.manage"
  },
  {
    "code": "invoice.profile.read",
    "module": "invoice",
    "category": "invoice",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "invoice.profile.read"
  },
  {
    "code": "invoice.request.cancel",
    "module": "invoice",
    "category": "invoice",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "invoice.request.cancel"
  },
  {
    "code": "invoice.request.create",
    "module": "invoice",
    "category": "invoice",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "invoice.request.create"
  },
  {
    "code": "invoice.request.decide",
    "module": "invoice",
    "category": "invoice",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "invoice.request.decide"
  },
  {
    "code": "invoice.request.read",
    "module": "invoice",
    "category": "invoice",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "invoice.request.read"
  },
  {
    "code": "invoice.request.red",
    "module": "invoice",
    "category": "invoice",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "invoice.request.red"
  },
  {
    "code": "marketing.read",
    "module": "marketing",
    "category": "marketing",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "marketing.read"
  },
  {
    "code": "member.address.manage",
    "module": "member",
    "category": "member",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "member.address.manage"
  },
  {
    "code": "member.address.read",
    "module": "member",
    "category": "member",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "member.address.read"
  },
  {
    "code": "member.favorite.manage",
    "module": "member",
    "category": "member",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "member.favorite.manage"
  },
  {
    "code": "member.favorite.read",
    "module": "member",
    "category": "member",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "member.favorite.read"
  },
  {
    "code": "member.import",
    "module": "member",
    "category": "member",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "member.import"
  },
  {
    "code": "member.manage",
    "module": "member",
    "category": "member",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "member.manage"
  },
  {
    "code": "member.profile.read",
    "module": "member",
    "category": "member",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand",
      "self",
      "owner"
    ],
    "makerChecker": false,
    "description": "member.profile.read"
  },
  {
    "code": "member.read",
    "module": "member",
    "category": "member",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "member.read"
  },
  {
    "code": "navigation.catalog.read",
    "module": "navigation",
    "category": "navigation",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform"
    ],
    "makerChecker": false,
    "description": "navigation.catalog.read"
  },
  {
    "code": "notification.ack",
    "module": "notification",
    "category": "notification",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "notification.ack"
  },
  {
    "code": "notification.announcement.manage",
    "module": "notification",
    "category": "notification",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "notification.announcement.manage"
  },
  {
    "code": "notification.announcement.read",
    "module": "notification",
    "category": "notification",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "notification.announcement.read"
  },
  {
    "code": "notification.endpoint.manage",
    "module": "notification",
    "category": "notification",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "notification.endpoint.manage"
  },
  {
    "code": "notification.preference.manage",
    "module": "notification",
    "category": "notification",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "notification.preference.manage"
  },
  {
    "code": "notification.preference.read",
    "module": "notification",
    "category": "notification",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "notification.preference.read"
  },
  {
    "code": "notification.read",
    "module": "notification",
    "category": "notification",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "notification.read"
  },
  {
    "code": "notification.template.manage",
    "module": "notification",
    "category": "notification",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "notification.template.manage"
  },
  {
    "code": "notification.template.read",
    "module": "notification",
    "category": "notification",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "notification.template.read"
  },
  {
    "code": "observability.clienterror.create",
    "module": "observability",
    "category": "observability",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "observability.clienterror.create"
  },
  {
    "code": "observability.clienterror.read",
    "module": "observability",
    "category": "observability",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "observability.clienterror.read"
  },
  {
    "code": "order.aftersale.apply",
    "module": "order",
    "category": "order",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "order.aftersale.apply"
  },
  {
    "code": "order.aftersale.decide",
    "module": "order",
    "category": "order",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "order.aftersale.decide"
  },
  {
    "code": "order.aftersale.read",
    "module": "order",
    "category": "order",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "order.aftersale.read"
  },
  {
    "code": "order.create",
    "module": "order",
    "category": "order",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "order.create"
  },
  {
    "code": "order.export",
    "module": "order",
    "category": "order",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "order.export"
  },
  {
    "code": "order.read",
    "module": "order",
    "category": "order",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "order.read"
  },
  {
    "code": "order.receive",
    "module": "order",
    "category": "order",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "enterprise",
      "mall",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "order.receive"
  },
  {
    "code": "order.reminder.create",
    "module": "order",
    "category": "order",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "order.reminder.create"
  },
  {
    "code": "organization.directory.manage",
    "module": "organization",
    "category": "organization",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "organization.directory.manage"
  },
  {
    "code": "organization.directory.read",
    "module": "organization",
    "category": "organization",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "organization.directory.read"
  },
  {
    "code": "organization.directory.sync",
    "module": "organization",
    "category": "organization",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "organization.directory.sync"
  },
  {
    "code": "organization.layer.manage",
    "module": "organization",
    "category": "organization",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform"
    ],
    "makerChecker": false,
    "description": "organization.layer.manage"
  },
  {
    "code": "organization.layer.read",
    "module": "organization",
    "category": "organization",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "organization.layer.read"
  },
  {
    "code": "partner.manage",
    "module": "partner",
    "category": "partner",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "partner.manage"
  },
  {
    "code": "partner.read",
    "module": "partner",
    "category": "partner",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "partner.read"
  },
  {
    "code": "payment.read",
    "module": "payment",
    "category": "payment",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "payment.read"
  },
  {
    "code": "payment.recovery.manage",
    "module": "payment",
    "category": "payment",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "payment.recovery.manage"
  },
  {
    "code": "payment.recovery.read",
    "module": "payment",
    "category": "payment",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "payment.recovery.read"
  },
  {
    "code": "payment.refund",
    "module": "payment",
    "category": "payment",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": true,
    "description": "payment.refund"
  },
  {
    "code": "pricing.offer.read",
    "module": "pricing",
    "category": "pricing",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "pricing.offer.read"
  },
  {
    "code": "pricing.rule.manage",
    "module": "pricing",
    "category": "pricing",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "pricing.rule.manage"
  },
  {
    "code": "qualification.manage",
    "module": "qualification",
    "category": "qualification",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "qualification.manage"
  },
  {
    "code": "qualification.preview",
    "module": "qualification",
    "category": "qualification",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "qualification.preview"
  },
  {
    "code": "qualification.read",
    "module": "qualification",
    "category": "qualification",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "qualification.read"
  },
  {
    "code": "referral.binding.create",
    "module": "referral",
    "category": "referral",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "enterprise",
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "referral.binding.create"
  },
  {
    "code": "referral.binding.read",
    "module": "referral",
    "category": "referral",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "enterprise",
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "referral.binding.read"
  },
  {
    "code": "referral.commission.read",
    "module": "referral",
    "category": "referral",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "enterprise",
      "mall"
    ],
    "makerChecker": false,
    "description": "referral.commission.read"
  },
  {
    "code": "referral.earning.readself",
    "module": "referral",
    "category": "referral",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "referral.earning.readself"
  },
  {
    "code": "referral.member.apply",
    "module": "referral",
    "category": "referral",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "enterprise",
      "mall",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "referral.member.apply"
  },
  {
    "code": "referral.member.decide",
    "module": "referral",
    "category": "referral",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "enterprise",
      "mall"
    ],
    "makerChecker": true,
    "description": "referral.member.decide"
  },
  {
    "code": "referral.member.read",
    "module": "referral",
    "category": "referral",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "enterprise",
      "mall"
    ],
    "makerChecker": false,
    "description": "referral.member.read"
  },
  {
    "code": "referral.product.manage",
    "module": "referral",
    "category": "referral",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "enterprise",
      "mall"
    ],
    "makerChecker": true,
    "description": "referral.product.manage"
  },
  {
    "code": "referral.product.read",
    "module": "referral",
    "category": "referral",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "enterprise",
      "mall"
    ],
    "makerChecker": false,
    "description": "referral.product.read"
  },
  {
    "code": "referral.setting.manage",
    "module": "referral",
    "category": "referral",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "enterprise",
      "mall"
    ],
    "makerChecker": true,
    "description": "referral.setting.manage"
  },
  {
    "code": "referral.setting.read",
    "module": "referral",
    "category": "referral",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "enterprise",
      "mall"
    ],
    "makerChecker": false,
    "description": "referral.setting.read"
  },
  {
    "code": "referral.withdrawal.create",
    "module": "referral",
    "category": "referral",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": false,
    "allowedScopeKinds": [
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "referral.withdrawal.create"
  },
  {
    "code": "referral.withdrawal.readself",
    "module": "referral",
    "category": "referral",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": false,
    "allowedScopeKinds": [
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "referral.withdrawal.readself"
  },
  {
    "code": "reporting.category.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.category.read"
  },
  {
    "code": "reporting.channel.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.channel.read"
  },
  {
    "code": "reporting.dashboard.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.dashboard.read"
  },
  {
    "code": "reporting.export.manage",
    "module": "reporting",
    "category": "reporting",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.export.manage"
  },
  {
    "code": "reporting.export.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.export.read"
  },
  {
    "code": "reporting.mall.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.mall.read"
  },
  {
    "code": "reporting.powderclass.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.powderclass.read"
  },
  {
    "code": "reporting.product.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.product.read"
  },
  {
    "code": "reporting.sales.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.sales.read"
  },
  {
    "code": "reporting.voucher.read",
    "module": "reporting",
    "category": "reporting",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "reporting.voucher.read"
  },
  {
    "code": "risk.manage",
    "module": "risk",
    "category": "risk",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "risk.manage"
  },
  {
    "code": "risk.read",
    "module": "risk",
    "category": "risk",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "risk.read"
  },
  {
    "code": "runtime.health.read",
    "module": "runtime",
    "category": "runtime",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": false,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "store",
      "supplier",
      "brand"
    ],
    "makerChecker": false,
    "description": "runtime.health.read"
  },
  {
    "code": "support.account.manage",
    "module": "support",
    "category": "support",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.account.manage"
  },
  {
    "code": "support.account.read",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.account.read"
  },
  {
    "code": "support.agent.manage",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.agent.manage"
  },
  {
    "code": "support.agent.read",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.agent.read"
  },
  {
    "code": "support.assignment.manage",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.assignment.manage"
  },
  {
    "code": "support.case.create",
    "module": "support",
    "category": "support",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "support.case.create"
  },
  {
    "code": "support.case.manage",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.case.manage"
  },
  {
    "code": "support.case.read",
    "module": "support",
    "category": "support",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "support.case.read"
  },
  {
    "code": "support.history.read",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.history.read"
  },
  {
    "code": "support.message.read",
    "module": "support",
    "category": "support",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "support.message.read"
  },
  {
    "code": "support.message.send",
    "module": "support",
    "category": "support",
    "risk": "elevated",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "support.message.send"
  },
  {
    "code": "support.rule.manage",
    "module": "support",
    "category": "support",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.rule.manage"
  },
  {
    "code": "support.rule.read",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.rule.read"
  },
  {
    "code": "support.sla.manage",
    "module": "support",
    "category": "support",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.sla.manage"
  },
  {
    "code": "support.sla.read",
    "module": "support",
    "category": "support",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "support.sla.read"
  },
  {
    "code": "verification.issue",
    "module": "verification",
    "category": "verification",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "store",
      "owner"
    ],
    "makerChecker": false,
    "description": "verification.issue"
  },
  {
    "code": "verification.verify",
    "module": "verification",
    "category": "verification",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "store"
    ],
    "makerChecker": false,
    "description": "verification.verify"
  },
  {
    "code": "voucher.batch.read",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.batch.read"
  },
  {
    "code": "voucher.binding.manage",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.binding.manage"
  },
  {
    "code": "voucher.binding.read",
    "module": "voucher",
    "category": "voucher",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department",
      "supplier",
      "brand",
      "store",
      "owner",
      "self"
    ],
    "makerChecker": false,
    "description": "voucher.binding.read"
  },
  {
    "code": "voucher.cardlibrary.allocate",
    "module": "voucher",
    "category": "voucher",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "voucher.cardlibrary.allocate"
  },
  {
    "code": "voucher.cardlibrary.create",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.cardlibrary.create"
  },
  {
    "code": "voucher.cardlibrary.manage",
    "module": "voucher",
    "category": "voucher",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.cardlibrary.manage"
  },
  {
    "code": "voucher.cardlibrary.read",
    "module": "voucher",
    "category": "voucher",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.cardlibrary.read"
  },
  {
    "code": "voucher.history.read",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.history.read"
  },
  {
    "code": "voucher.issue",
    "module": "voucher",
    "category": "voucher",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "voucher.issue"
  },
  {
    "code": "voucher.program.manage",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.program.manage"
  },
  {
    "code": "voucher.program.read",
    "module": "voucher",
    "category": "voucher",
    "risk": "low",
    "minimumAssurance": 1,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.program.read"
  },
  {
    "code": "voucher.redemption.read",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "owner"
    ],
    "makerChecker": false,
    "description": "voucher.redemption.read"
  },
  {
    "code": "voucher.redemption.reverse",
    "module": "voucher",
    "category": "voucher",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "voucher.redemption.reverse"
  },
  {
    "code": "voucher.reserve.decide",
    "module": "voucher",
    "category": "voucher",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "voucher.reserve.decide"
  },
  {
    "code": "voucher.reserve.read",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.reserve.read"
  },
  {
    "code": "voucher.reserve.request",
    "module": "voucher",
    "category": "voucher",
    "risk": "high",
    "minimumAssurance": 2,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": false,
    "description": "voucher.reserve.request"
  },
  {
    "code": "voucher.status.manage",
    "module": "voucher",
    "category": "voucher",
    "risk": "critical",
    "minimumAssurance": 3,
    "delegatable": true,
    "allowedScopeKinds": [
      "platform",
      "distributor",
      "tenant",
      "enterprise",
      "mall",
      "department"
    ],
    "makerChecker": true,
    "description": "voucher.status.manage"
  }
] as const satisfies readonly PermissionDefinition[]);
const byCode: ReadonlyMap<string, PermissionDefinition> = new Map(PERMISSION_CATALOG.map((permission) => [permission.code, permission]));
export function permissionDefinition(code: string): PermissionDefinition { const permission=byCode.get(code); if(!permission) throw new Error('PERMISSION_UNKNOWN'); return permission; }
