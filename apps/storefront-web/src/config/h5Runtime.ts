const H5_STOREFRONT_HOST = 'h5.zhudatuan.com';
const MINI_PROGRAM_STOREFRONT_HOST = 'mini.zhudatuan.com';
const H5_DOCUMENT_PATH = '/h5';

function isStaticAssetPath(pathname: string): boolean {
  return pathname.startsWith('/assets/')
    || pathname.startsWith('/_next/')
    || /\.[a-z0-9]+$/i.test(pathname);
}

export function resolveH5RuntimeRequest(request: Request): Request {
  const target = new URL(request.url);
  if ((target.hostname !== H5_STOREFRONT_HOST && target.hostname !== MINI_PROGRAM_STOREFRONT_HOST)
    || (request.method !== 'GET' && request.method !== 'HEAD')
    || target.pathname === '/api'
    || target.pathname.startsWith('/api/')
    || isStaticAssetPath(target.pathname)) return request;

  if (target.pathname === H5_DOCUMENT_PATH) return request;
  target.pathname = H5_DOCUMENT_PATH;
  return new Request(target, request);
}
