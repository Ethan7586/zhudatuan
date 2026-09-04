import { remoteProviderFactory } from '@shop/providercore';
import { ChargeCapabilities } from './capability';
import { ChargeMapper, createChargeClient } from './integration';
import { definition } from './Manifest';

export const ChargeProvider = remoteProviderFactory({ definition, operations: ChargeCapabilities, mapper: new ChargeMapper(), client: createChargeClient });
