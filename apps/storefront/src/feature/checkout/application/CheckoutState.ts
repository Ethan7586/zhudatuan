import type { Checkout } from '../model/Checkout';

export const checkoutQuery = (scope: string) => Object.freeze(['storefront', scope, 'checkout', 'current'] as const);

export const EMPTY_CHECKOUT: Checkout = Object.freeze({ quote: null, status: 'idle' });
