import { remoteProviderFactory } from '@shop/providercore';
import { MealCapabilities } from './capability';
import { createMealClient, MealMapper } from './integration';
import { definition } from './Manifest';

export const MealProvider = remoteProviderFactory({ definition, operations: MealCapabilities, mapper: new MealMapper(), client: createMealClient });
