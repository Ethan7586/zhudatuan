import { defineModule } from '../../bootstrap/DefinedModule';
import { checkoutOperations } from './CheckoutOperations';
import { Manifest } from './Manifest';
import { AddressPort, MEMBER_ADDRESS_PORT } from './AddressPort';
export const CheckoutModule = defineModule(Manifest, checkoutOperations, [{ token: MEMBER_ADDRESS_PORT, value: new AddressPort() }]);
