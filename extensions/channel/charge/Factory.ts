import { remoteProviderFactory } from '@shop/providercore';
import { ChargeOperations } from './capability';
import { createChargeClient } from './Client';
import { definition } from './Manifest';
import { ChargeMapper } from './Mapper';

export const ChargeProvider = remoteProviderFactory({ definition, operations: ChargeOperations, mapper: new ChargeMapper(), client: createChargeClient });
