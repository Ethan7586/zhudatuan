import { defineModule } from '../../bootstrap/DefinedModule';
import { extensionRoutes } from './interface/http/ExtensionRoutes';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { PgExtensionRepository } from './infrastructure/persistence/PgExtensionRepository';
import type { ExtensionRepository } from './application/port/ExtensionLoader';
export { InstallExtension } from './application/command/InstallExtension';
export { EnableExtension } from './application/command/EnableExtension';
export { DisableExtension } from './application/command/DisableExtension';
export { EXTENSION_LOADER } from './application/port/ExtensionLoader';
export type { ExtensionCandidate,ExtensionRepositoryFactory,ExtensionStateSink } from './application/port/ExtensionLoader';
export { ContractPolicy } from './domain/policy/ContractPolicy';
export function extensionRepository(database:OperationDatabase):ExtensionRepository { return new PgExtensionRepository(database); }
export const ExtensionModule = defineModule('extension', ['capability'], extensionRoutes);
