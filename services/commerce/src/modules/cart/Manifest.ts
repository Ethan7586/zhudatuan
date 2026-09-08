import { defineModuleManifest } from '../../composition/ModuleManifest';
import { CART_READ_PORT, CHECKOUT_CART_PORT } from './public';

export const Manifest = defineModuleManifest({ id: 'cart', dependencies: ['access', 'catalog', 'experience', 'inventory', 'pricing'], ports: [CHECKOUT_CART_PORT, CART_READ_PORT] });
