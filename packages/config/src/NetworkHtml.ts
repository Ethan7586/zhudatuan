import { NETWORK_CATALOG } from './NetworkCatalog.ts';

const replacements = Object.freeze({
  '%CANONICAL_API_ORIGIN%': NETWORK_CATALOG.origins.api,
  '%CANONICAL_AUTH_ORIGIN%': NETWORK_CATALOG.origins.auth,
  '%CANONICAL_CONSOLE_ORIGIN%': NETWORK_CATALOG.origins.console,
  '%CANONICAL_STOREFRONT_ORIGIN%': NETWORK_CATALOG.origins.storefront,
  '%CANONICAL_MINIAPP_ORIGIN%': NETWORK_CATALOG.origins.miniapp,
  '%CANONICAL_STORE_ORIGIN%': NETWORK_CATALOG.origins.store,
  '%CANONICAL_SUPPLIER_ORIGIN%': NETWORK_CATALOG.origins.supplier,
});

export function networkHtml(source: string): string {
  const resolved = Object.entries(replacements).reduce((html, [token, value]) => html.replaceAll(token, value), source);
  if (resolved.includes('rel="preconnect" href="%CANONICAL_API_ORIGIN%"')) throw new Error('NETWORK_HTML_API_ORIGIN_UNRESOLVED');
  if (resolved.includes(`rel="preconnect" href="${NETWORK_CATALOG.origins.api}"`)) return resolved;
  return resolved.replace('</head>', `    <link rel="dns-prefetch" href="//${new URL(NETWORK_CATALOG.origins.api).host}" />\n    <link rel="preconnect" href="${NETWORK_CATALOG.origins.api}" crossorigin />\n  </head>`);
}
