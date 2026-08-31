import { remoteProviderFactory } from '@shop/providercore';
import { FoodvoucherOperations } from './capability';
import { createFoodvoucherClient } from './Client';
import { definition } from './Manifest';
import { FoodvoucherMapper } from './Mapper';

export const FoodvoucherProvider = remoteProviderFactory({ definition, operations: FoodvoucherOperations, mapper: new FoodvoucherMapper(), client: createFoodvoucherClient });
