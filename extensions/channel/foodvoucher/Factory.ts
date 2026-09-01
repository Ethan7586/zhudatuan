import { remoteProviderFactory } from '@shop/providercore';
import { FoodvoucherCapabilities } from './capability';
import { createFoodvoucherClient } from './Client';
import { definition } from './Manifest';
import { FoodvoucherMapper } from './Mapper';

export const FoodvoucherProvider = remoteProviderFactory({ definition, operations: FoodvoucherCapabilities, mapper: new FoodvoucherMapper(), client: createFoodvoucherClient });
