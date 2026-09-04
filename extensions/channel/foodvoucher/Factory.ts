import { remoteProviderFactory } from '@shop/providercore';
import { FoodvoucherCapabilities } from './capability';
import { createFoodvoucherClient, FoodvoucherMapper } from './integration';
import { definition } from './Manifest';

export const FoodvoucherProvider = remoteProviderFactory({ definition, operations: FoodvoucherCapabilities, mapper: new FoodvoucherMapper(), client: createFoodvoucherClient });
