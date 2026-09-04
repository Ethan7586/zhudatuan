import type { ProviderPorts } from '@shop/contract';

export type SupplierOrderSubmitter = Pick<ProviderPorts, 'order' | 'cancel' | 'tracking' | 'return'>;
