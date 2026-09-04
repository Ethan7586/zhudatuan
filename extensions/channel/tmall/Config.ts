import { providerConnectionConfig } from '@shop/config/provider';
import { validateProviderConnection, type IntegrationConnection } from '@shop/providercore';
import { definition } from './Manifest';

export const TmallConfig = Object.freeze({ schema: definition.configSchema, secretRefs: definition.secretRefs, parse: (value: unknown) => providerConnectionConfig(value, definition.healthOperation), validate: (connection: IntegrationConnection) => validateProviderConnection(definition, connection) });
