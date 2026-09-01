import { NETWORK_CATALOG } from './NetworkCatalog.ts';

const replacements = Object.freeze({
  '%CANONICAL_AUTH_ORIGIN%': NETWORK_CATALOG.origins.auth,
  '%CANONICAL_CONSOLE_ORIGIN%': NETWORK_CATALOG.origins.console,
  '%CANONICAL_STOREFRONT_ORIGIN%': NETWORK_CATALOG.origins.storefront,
});

export function networkHtml(source: string): string {
  return Object.entries(replacements).reduce((html, [token, value]) => html.replaceAll(token, value), source);
}
