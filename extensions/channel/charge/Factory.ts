import { remoteProviderFactory } from '@shop/providercore';
import { ChargeCapabilities } from './capability';
import { createChargeClient } from './Client';
import { definition } from './Manifest';
import { ChargeMapper } from './Mapper';

export const ChargeProvider = remoteProviderFactory({ definition, operations: ChargeCapabilities, mapper: new ChargeMapper(), client: createChargeClient });
