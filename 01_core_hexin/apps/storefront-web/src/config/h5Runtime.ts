import { PRODUCTION_IDENTITY_NODE_REGISTRY } from '@shop/sdk/identity-node';

const H5_STOREFRONT_HOST = PRODUCTION_IDENTITY_NODE_REGISTRY.nodes
  .find((node) => node.nodeId === 'node:zhudatuan:l0')
  ?.storefrontHosts.find((host) => host.startsWith('h5.'));
if (!H5_STOREFRONT_HOST) throw new Error('H5_STOREFRONT_HOST_MISSING');
const H5_DOCUMENT_PATH = '/h5';

function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith('/assets/')
    || pathname.startsWith('/_next/')
    || /\.[a-z0-9]+$/i.test(pathname);
}

export function resolveH5RuntimeRequest(request: Request): Request {
  const target = new URL(request.url);
  if (target.hostname !== H5_STOREFRONT_HOST
    || (request.method !== 'GET' && request.method !== 'HEAD')
    || target.pathname === '/api'
    || target.pathname.startsWith('/api/')
    || isStaticAssetPath(target.pathname)) return request;

  if (target.pathname === H5_DOCUMENT_PATH) return request;
  target.pathname = H5_DOCUMENT_PATH;
  return new Request(target, request);
}
