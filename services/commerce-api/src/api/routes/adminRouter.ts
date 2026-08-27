import { handleAdminCatalog, handleAdminOverview, handleSetProductStatus } from '../adminRoutes';
import { handleCreateCustomRole, handleCustomRoleCenter, handleSetCustomRoleStatus, handleUpdateCustomRole } from '../customRoleRoutes';
import { handleVerifyMemberCodeChallenge } from '../memberCodeRoutes';
import { handleAdminCreateMember, handleCreateMemberInvite, handleDisableMemberInvite, handleMemberImport, handleMemberOperations, handleUpdateMemberProfile } from '../memberOperationsRoutes';
import { handleExecuteRefund, handleFinanceReconciliation, handleShipOrder } from '../orderRoutes';
import { handleMembershipAccess, handleMembershipStatus, handlePermissionCommandCenter } from '../permissionAdminRoutes';
import { handleQualificationCenter, handleQualificationConfig } from '../qualificationAdminRoutes';
import {
  handleEmployeeQualification,
  handleQualificationGovernance,
  handleQualificationHistory,
  handleQualificationPreview,
  handleQualificationReview,
  handleQualificationRollback,
  handleQualificationSimulation,
} from '../qualificationGovernanceRoutes';
import type { AuthorizationContext, WorkerEnv } from '../types';

const API_PREFIX = '/api/v1';

export async function routeAdminRequest(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  switch (pathname) {
    case `${API_PREFIX}/admin/products`:
      return handleAdminCatalog(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/overview`:
      return handleAdminOverview(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/access-control`:
      return handlePermissionCommandCenter(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/roles`:
      return request.method === 'POST' ? handleCreateCustomRole(request, env, authorization, requestId) : handleCustomRoleCenter(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/member-operations`:
      return handleMemberOperations(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/member-operations/invitations`:
      return handleCreateMemberInvite(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/member-operations/members`:
      return handleAdminCreateMember(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/member-code/verify`:
      return handleVerifyMemberCodeChallenge(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/member-operations/imports`:
      return handleMemberImport(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center`:
      return handleQualificationCenter(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center/config`:
      return handleQualificationConfig(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center/governance`:
      return handleQualificationGovernance(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center/preview`:
      return handleQualificationPreview(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center/review`:
      return handleQualificationReview(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center/history`:
      return handleQualificationHistory(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center/rollback`:
      return handleQualificationRollback(request, env, authorization, requestId);
    case `${API_PREFIX}/admin/qualification-center/simulate`:
      return handleQualificationSimulation(request, env, authorization, requestId);
    case `${API_PREFIX}/finance/reconciliation`:
      return handleFinanceReconciliation(request, env, authorization, requestId);
  }

  const roleStatus = pathname.match(/^\/api\/v1\/admin\/roles\/([^/]+)\/status$/);
  if (roleStatus) return handleSetCustomRoleStatus(request, env, authorization, decodeURIComponent(roleStatus[1]), requestId);
  const role = pathname.match(/^\/api\/v1\/admin\/roles\/([^/]+)$/);
  if (role) return handleUpdateCustomRole(request, env, authorization, decodeURIComponent(role[1]), requestId);
  const invitation = pathname.match(/^\/api\/v1\/admin\/member-operations\/invitations\/([^/]+)$/);
  if (invitation) return handleDisableMemberInvite(request, env, authorization, decodeURIComponent(invitation[1]), requestId);
  const member = pathname.match(/^\/api\/v1\/admin\/member-operations\/members\/([^/]+)$/);
  if (member) return handleUpdateMemberProfile(request, env, authorization, decodeURIComponent(member[1]), requestId);
  const employee = pathname.match(/^\/api\/v1\/admin\/qualification-center\/employees\/([^/]+)$/);
  if (employee) return handleEmployeeQualification(request, env, authorization, decodeURIComponent(employee[1]), requestId);
  const membershipAccess = pathname.match(/^\/api\/v1\/admin\/memberships\/([^/]+)\/access$/);
  if (membershipAccess) return handleMembershipAccess(request, env, authorization, decodeURIComponent(membershipAccess[1]), requestId);
  const membershipStatus = pathname.match(/^\/api\/v1\/admin\/memberships\/([^/]+)\/status$/);
  if (membershipStatus) return handleMembershipStatus(request, env, authorization, decodeURIComponent(membershipStatus[1]), requestId);
  const productStatus = pathname.match(/^\/api\/v1\/admin\/products\/([^/]+)\/status$/);
  if (productStatus) return handleSetProductStatus(request, env, authorization, decodeURIComponent(productStatus[1]), requestId);
  const refund = pathname.match(/^\/api\/v1\/after-sales\/([^/]+)\/refund$/);
  if (refund) return handleExecuteRefund(request, env, authorization, decodeURIComponent(refund[1]), requestId);
  const ship = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/ship$/);
  if (ship) return handleShipOrder(request, env, authorization, decodeURIComponent(ship[1]), requestId);
  return null;
}
