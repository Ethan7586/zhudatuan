import { defineModule } from '../../bootstrap/DefinedModule';
import { cartOperations } from './CartOperations';
export const CartModule = defineModule('cart', ['catalog'], cartOperations);
export { CartPort, cartPort } from './CartPort';
