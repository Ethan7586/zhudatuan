import { defineModule } from '../../bootstrap/DefinedModule';
import { orderOperations } from './OrderOperations';
export { GetOrderSummary } from './application/GetOrderSummary';
export { OrderPort, orderPort } from './OrderPort';
export const OrderModule = defineModule('order', ['checkout', 'inventory', 'benefit', 'voucher', 'reporting'], orderOperations);
