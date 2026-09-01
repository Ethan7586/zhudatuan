import { remoteProviderFactory } from '@shop/providercore';
import { MealCapabilities } from './capability';
import { createMealClient } from './Client';
import { definition } from './Manifest';
import { MealMapper } from './Mapper';

export const MealProvider = remoteProviderFactory({ definition, operations: MealCapabilities, mapper: new MealMapper(), client: createMealClient });
