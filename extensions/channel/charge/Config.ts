import { validateProviderConnection, type IntegrationConnection } from '@shop/providercore';
import { definition } from './Manifest';

export const ChargeConfig = Object.freeze({ schema: definition.configSchema, secretRefs: definition.secretRefs, validate: (connection: IntegrationConnection) => validateProviderConnection(definition, connection) });
