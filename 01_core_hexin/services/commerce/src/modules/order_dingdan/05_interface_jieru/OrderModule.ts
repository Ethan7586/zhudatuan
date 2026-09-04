import { defineModule } from '../../../bootstrap/DefinedModule';
import { orderOperations } from '../03_application_yingyong/services_fuwu/OrderOperations';
export const OrderModule = defineModule('order', ['checkout', 'inventory', 'benefit', 'voucher', 'reporting'], orderOperations);
