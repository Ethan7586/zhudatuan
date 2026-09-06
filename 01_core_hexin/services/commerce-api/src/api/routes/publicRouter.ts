import { handleHealth } from '../publicRoutes';
import { handlePublicCatalog } from '../publicCatalogRoutes';
import { handlePublicCatalogImage, isPublicCatalogImagePath } from '../publicCatalogImages';
import type { WorkerEnv } from '../types';
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
    case `${API_PREFIX}/payments/wechat/notify`:
      return handleWechatPaymentNotification(request, env, requestId);
    default:
      return null;
  }
}
