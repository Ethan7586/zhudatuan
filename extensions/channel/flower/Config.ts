import { validateProviderConnection, type IntegrationConnection } from '@shop/providercore';
import { definition } from './Manifest';

export const FlowerConfig = Object.freeze({ schema: definition.configSchema, secretRefs: definition.secretRefs, validate: (connection: IntegrationConnection) => validateProviderConnection(definition, connection) });
