import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { productKey, readProducts, type ProductQuery } from '../product/ProductQuery';
import { supplyPartnersFromListingPage } from './SupplyChainModel';

const perspectiveQuery: ProductQuery = Object.freeze({ q: '', category: '', status: '', limit: 100, preview: true });

export const supplierPerspectiveKey = (context: ConsoleContext) => productKey(context, perspectiveQuery);

export async function readSupplierPerspectives(context: ConsoleContext, signal: AbortSignal) {
  return supplyPartnersFromListingPage(await readProducts(context, perspectiveQuery, signal));
}
