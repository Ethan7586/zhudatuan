import { handleHealth, handleInitialPasswordChange, handleLogin, handleLogout, handleRegisteredCredentialDiscovery } from '../publicRoutes';
import { handlePublicCatalog } from '../publicCatalogRoutes';
import { handlePublicCatalogImage, isPublicCatalogImagePath } from '../publicCatalogImages';
import { handleRegistration, handleRegistrationOtp, handleUsernameRegistration } from '../registrationRoutes';
import { handleResetPassword, handleSecurityOtp } from '../securityCenterRoutes';
import type { WorkerEnv } from '../types';
import { handleWechatBind, handleWechatRegistration, handleWechatSession } from '../wechatAuthRoutes';
import { handleWechatPaymentNotification } from '../wechatPaymentNotificationRoute';

const API_PREFIX = '/api/v1';

export async function routePublicRequest(request: Request, env: WorkerEnv, requestId: string): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (isPublicCatalogImagePath(pathname)) return handlePublicCatalogImage(request, env, requestId);
  switch (pathname) {
    case '/api/health':
      return handleHealth(request, env, requestId);
    case `${API_PREFIX}/catalog/public/products`:
      return handlePublicCatalog(request, env, requestId);
    case `${API_PREFIX}/auth/login`:
      return handleLogin(request, env, requestId);
    case `${API_PREFIX}/auth/credential/discover`:
      return handleRegisteredCredentialDiscovery(request, env, requestId);
    case `${API_PREFIX}/auth/password/initial-change`:
      return handleInitialPasswordChange(request, env, requestId);
    case `${API_PREFIX}/auth/logout`:
      return handleLogout(request, env, requestId);
    case `${API_PREFIX}/auth/registration/otp`:
      return handleRegistrationOtp(request, env, requestId);
    case `${API_PREFIX}/auth/register`:
      return handleRegistration(request, env, requestId);
    case `${API_PREFIX}/auth/register/username`:
      return handleUsernameRegistration(request, env, requestId);
    case `${API_PREFIX}/auth/security/otp`:
      return handleSecurityOtp(request, env, requestId);
    case `${API_PREFIX}/auth/password/reset`:
      return handleResetPassword(request, env, requestId);
    case `${API_PREFIX}/auth/wechat/session`:
      return handleWechatSession(request, env, requestId);
    case `${API_PREFIX}/auth/wechat/bind`:
      return handleWechatBind(request, env, requestId);
    case `${API_PREFIX}/auth/wechat/register`:
      return handleWechatRegistration(request, env, requestId);
    case `${API_PREFIX}/payments/wechat/notify`:
      return handleWechatPaymentNotification(request, env, requestId);
    default:
      return null;
  }
}
