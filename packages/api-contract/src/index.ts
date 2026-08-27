/** Shared authorization contracts. Browser clients receive only safe projections. */

import { PERMISSIONS } from './permissions';
export { PERMISSIONS, PERMISSION_CATALOG } from './permissions';
export type { PermissionDefinition, PermissionRisk } from './permissions';
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export { ORDER_STATUS, PAYMENT_STATUS, toPaymentStatus } from './commerce';
export type { OrderPaymentStatus, OrderStatus, PaymentStatus, WechatPaymentAttemptStatus } from './commerce';
export { CLIENT_PLATFORM, REQUIRED_DELIVERY_PLATFORMS, RESERVED_DELIVERY_PLATFORMS } from './platform';
export { MEMBER_CODE_PROTOCOL, MEMBER_CODE_VALID_SECONDS } from './memberCode';
export type { MemberCodeChallengeResponse, MemberCodeVerificationResponse } from './memberCode';
export type {
  AsyncOperation,
  AsyncOperationState,
  ClientPaymentInvocation,
  ClientPlatform,
  CommercePlatformAdapters,
  ConsistencyMode,
  PlatformCredential,
  PlatformIdentityAdapter,
  PlatformLifecycleAdapter,
  PlatformNavigationAdapter,
  PlatformPaymentAdapter,
  PlatformShareAdapter,
  PlatformStorageAdapter,
  PlatformTelemetryAdapter,
  ResponseMeta,
} from './platform';

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'offboarded' | 'expired';
export type MembershipTarget = 'storefront' | 'admin';
/** Reserved kinds stay in the contract but fail closed until their resource tables are connected. */
export type ScopeKind = 'platform' | 'tenant' | 'distributor' | 'enterprise' | 'mall' | 'supplier' | 'brand' | 'store' | 'department' | 'self';

/** The tenant context that is fixed when a membership is activated. */
export interface MembershipContextScope {
  tenantId: string;
  enterpriseId?: string;
  mallId?: string;
  supplierId?: string;
  distributorId?: string;
  brandId?: string;
  storeId?: string;
  departmentId?: string;
  userId?: string;
}

/** A positive authorization grant. It is never inferred from client input. */
export interface ScopeBinding {
  kind: ScopeKind;
  resourceId: string;
}

/** Facts loaded by commerce-api from the requested resource's database row. */
export interface ResourceScope {
  tenantId: string;
  enterpriseId?: string;
  mallId?: string;
  supplierId?: string;
  distributorId?: string;
  brandId?: string;
  storeId?: string;
  departmentId?: string;
  ownerUserId?: string;
  /**
   * Server-derived ancestors for hierarchical organization resources. Browser
   * input must never populate this path. Legacy flat IDs remain supported
   * during migration.
   */
  orgUnitPath?: ScopeBinding[];
}

export interface Membership {
  id: string;
  memberId: string;
  target: MembershipTarget;
  status: MembershipStatus;
  roleIds: string[];
  permissions: Permission[];
  /** Discord-style explicit deny overrides every additive role grant. */
  deniedPermissions?: Permission[];
  context: MembershipContextScope;
  scopeBindings: ScopeBinding[];
  expiresAt: string | null;
  authzVersion: number;
}

/** A session identifies one active membership, never a union of memberships. */
export interface SessionContext {
  sessionId: string;
  memberId: string;
  membershipId: string;
  target: MembershipTarget;
  issuedAt: string;
  expiresAt: string;
  authzVersion: number;
  stepUpAt: string | null;
}

export interface AuthorizationEvidence {
  membershipId: string;
  roleIds: string[];
  permission: Permission;
  scope: ScopeBinding;
}

export interface AuthorizationDecision {
  allowed: boolean;
  reason: 'ALLOWED' | 'MEMBERSHIP_INACTIVE' | 'PERMISSION_DENIED' | 'PERMISSION_MISSING' | 'TENANT_MISMATCH' | 'SCOPE_MISMATCH' | 'STEP_UP_REQUIRED';
  evidence?: AuthorizationEvidence;
}

export interface ApiError {
  code: string;
  message: string;
  requestId?: string;
}
