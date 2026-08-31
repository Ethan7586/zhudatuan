import { remoteProviderFactory } from '@shop/providercore';
import { MealOperations } from './capability';
import { createMealClient } from './Client';
import { definition } from './Manifest';
import { MealMapper } from './Mapper';

export const MealProvider = remoteProviderFactory({ definition, operations: MealOperations, mapper: new MealMapper(), client: createMealClient });
