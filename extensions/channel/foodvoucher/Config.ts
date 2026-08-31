import { validateProviderConnection, type IntegrationConnection } from '@shop/providercore';
import { definition } from './Manifest';

export const FoodvoucherConfig = Object.freeze({ schema: definition.configSchema, secretRefs: definition.secretRefs, validate: (connection: IntegrationConnection) => validateProviderConnection(definition, connection) });
