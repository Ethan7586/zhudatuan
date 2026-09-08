import { StorefrontQuery, type StorefrontScopedQueryIdentity } from '../../../shared/api/Query';

export const invoiceQuery = (identity: StorefrontScopedQueryIdentity) => Object.freeze([...StorefrontQuery.orders(identity), 'invoices'] as const);
