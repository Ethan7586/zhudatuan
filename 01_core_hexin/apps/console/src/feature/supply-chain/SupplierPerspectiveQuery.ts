import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { productKey, readProducts, type ProductQuery } from '../product/ProductQuery';
import { ListingPageSchema } from '../product/ProductSchema';
import { supplyPartnersFromListingPage } from './SupplyChainModel';

const perspectiveQuery: ProductQuery = Object.freeze({ q: '', category: '', status: '', limit: 100, preview: true });

export const supplierPerspectiveKey = (context: ConsoleContext) => productKey(context, perspectiveQuery);

export async function readSupplierPerspectives(context: ConsoleContext, signal: AbortSignal) {
  const prefetched = await takeDocumentReportSupplierPrefetch(context, signal);
  if (prefetched !== undefined) return prefetched;
  return supplyPartnersFromListingPage(await readProducts(context, perspectiveQuery, signal));
}

async function takeDocumentReportSupplierPrefetch(context: ConsoleContext, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleReportSupplierPrefetch;
  delete window.__consoleReportSupplierPrefetch;
  if (slot === undefined) return undefined;
  if (signal.aborted) {
    window.__consoleAbortDocumentPrefetch?.();
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
  let rejectAbort: (cause: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const abort = () => {
    window.__consoleAbortDocumentPrefetch?.();
    rejectAbort(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const value = await Promise.race([slot.promise, aborted]);
    const matches = value?.scopeKind === context.scope.kind
      && value.scopeId === context.scope.id
      && value.accessVersion === context.session.accessVersion;
    if (!matches) return undefined;
    const parsed = ListingPageSchema.safeParse(value.value);
    return parsed.success ? supplyPartnersFromListingPage(parsed.data) : undefined;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
