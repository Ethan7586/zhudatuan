import { handleAccountLedgers, handleAccounts, handleBootstrap } from '../accountRoutes';
import { handleAddresses, handleDeleteAddress } from '../addressRoutes';
import { handleCart, handleDeleteCartItem } from '../cartRoutes';
import { handleHomeSnapshot } from '../homeRoutes';
import { json } from '../http';
import { handleMemberCodeChallenge, handleRevokeMemberCodeChallenge } from '../memberCodeRoutes';
import { handleAfterSales, handleCreateAfterSale, handleCreateOrder, handleInternalPayment, handleOrders } from '../orderRoutes';
import { handleProducts } from '../publicRoutes';
import { handleChangePassword, handleChangePhone, handleRevokeOtherSessions, handleRevokeSession, handleSecurityCenter } from '../securityCenterRoutes';
import { handleStepUp } from '../stepUpRoutes';
import type { AuthorizationContext, WorkerEnv } from '../types';
import { handleOrderByNumber, handleWechatPaymentStatus, handleWechatPrepay } from '../wechatPaymentRoutes';

const API_PREFIX = '/api/v1';

export async function routeStorefrontRequest(request: Request, env: WorkerEnv, authorization: AuthorizationContext, requestId: string): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  switch (pathname) {
    case `${API_PREFIX}/products`:
      return handleProducts(request, env, authorization, requestId);
    case `${API_PREFIX}/bootstrap`:
      return handleBootstrap(request, env, authorization, requestId);
    case `${API_PREFIX}/home`:
      return handleHomeSnapshot(request, env, authorization, requestId);
    case `${API_PREFIX}/member-code/challenge`:
      return handleMemberCodeChallenge(request, env, authorization, requestId);
    case `${API_PREFIX}/member-code/challenge/revoke`:
      return handleRevokeMemberCodeChallenge(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/session`:
      return json({ authenticated: true, authorization: publicAuthorization(authorization), requestId });
    case `${API_PREFIX}/auth/step-up`:
      return handleStepUp(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/security-center`:
      return handleSecurityCenter(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/password/change`:
      return handleChangePassword(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/phone/change`:
      return handleChangePhone(request, env, authorization, requestId);
    case `${API_PREFIX}/auth/sessions/revoke-others`:
      return handleRevokeOtherSessions(request, env, authorization, requestId);
    case `${API_PREFIX}/accounts`:
      return handleAccounts(request, env, authorization, requestId);
    case `${API_PREFIX}/cart`:
      return handleCart(request, env, authorization, requestId);
    case `${API_PREFIX}/addresses`:
      return handleAddresses(request, env, authorization, requestId);
    case `${API_PREFIX}/account-ledgers`:
      return handleAccountLedgers(request, env, authorization, requestId);
    case `${API_PREFIX}/after-sales`:
      return request.method === 'POST' ? handleCreateAfterSale(request, env, authorization, requestId) : handleAfterSales(request, env, authorization, requestId);
    case `${API_PREFIX}/orders`:
      return request.method === 'POST' ? handleCreateOrder(request, env, authorization, requestId) : handleOrders(request, env, authorization, requestId);
  }

  const session = pathname.match(/^\/api\/v1\/auth\/sessions\/([0-9a-f-]{36})$/i);
  if (session) return handleRevokeSession(request, env, authorization, session[1], requestId);
  const address = pathname.match(/^\/api\/v1\/addresses\/([^/]+)$/);
  if (address) return handleDeleteAddress(request, env, authorization, decodeURIComponent(address[1]), requestId);
  const cartItem = pathname.match(/^\/api\/v1\/cart\/([^/]+)$/);
  if (cartItem) return handleDeleteCartItem(request, env, authorization, decodeURIComponent(cartItem[1]), requestId);
  const orderByNumber = pathname.match(/^\/api\/v1\/orders\/by-number\/([^/]+)$/);
  if (orderByNumber) return handleOrderByNumber(request, env, authorization, decodeURIComponent(orderByNumber[1]), requestId);
  const wechatPrepay = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/payments\/wechat\/prepay$/);
  if (wechatPrepay) return handleWechatPrepay(request, env, authorization, decodeURIComponent(wechatPrepay[1]), requestId);
  const paymentStatus = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/payment-status$/);
  if (paymentStatus) return handleWechatPaymentStatus(request, env, authorization, decodeURIComponent(paymentStatus[1]), requestId);
  const internalPayment = pathname.match(/^\/api\/v1\/orders\/([^/]+)\/payments\/internal$/);
  if (internalPayment) return handleInternalPayment(request, env, authorization, decodeURIComponent(internalPayment[1]), requestId);
  return null;
}

function publicAuthorization(context: AuthorizationContext) {
  return {
    memberId: context.membership.memberId,
    membershipId: context.membership.id,
    target: context.membership.target,
    roles: context.roles,
    permissions: context.permissions,
  };
}
