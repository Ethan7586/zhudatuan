import { defineModule } from '../../../bootstrap/DefinedModule';
import { cartOperations } from '../03_application_yingyong/CartOperations';

export const CartModule = defineModule('cart', ['catalog'], cartOperations);
