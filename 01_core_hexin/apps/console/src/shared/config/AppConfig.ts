import { clientEnvironment } from '@shop/config/client';

const canonical = clientEnvironment();

function runtimeClientEnvironment() {
  if (typeof window === 'undefined' || !window.location.hostname.startsWith('console.')
    || window.location.hostname === 'console.zhudatuan.com') return canonical;
  const publicDomain = window.location.hostname.slice('console.'.length);
  return Object.freeze({
    ...canonical,
    apiBaseUrl: `https://api.${publicDomain}`,
    authBaseUrl: `https://accounts.${publicDomain}`,
  });
}

export const appConfig = runtimeClientEnvironment();
