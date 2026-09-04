export const ORDER_LIST_VIEWS = Object.freeze(['all', 'unpaid', 'unshipped', 'active', 'completed', 'exception'] as const);
export const ORDER_PLACED_FILTERS = Object.freeze(['today', '7days', '30days'] as const);
export const ORDER_LIFECYCLE_STATES = Object.freeze(['created', 'awaitingpayment', 'paid', 'fulfilling', 'shipped', 'received', 'completed', 'cancelled'] as const);
export const ORDER_PAYMENT_STATES = Object.freeze(['unpaid', 'authorizing', 'paid', 'partially_refunded', 'refunded', 'failed'] as const);
export const ORDER_FULFILLMENT_STATES = Object.freeze(['unallocated', 'allocated', 'processing', 'shipped', 'delivered', 'received', 'cancelled', 'returned'] as const);
export const ORDER_AFTERSALE_STATES = Object.freeze(['none', 'applied', 'reviewing', 'approved', 'returning', 'received', 'refunding', 'resolved', 'rejected'] as const);
