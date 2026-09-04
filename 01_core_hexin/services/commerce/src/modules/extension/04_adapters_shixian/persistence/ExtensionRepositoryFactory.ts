import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ExtensionRepository } from '../../01_public_gongkai/ExtensionLoader';
import { PgExtensionRepository } from './PgExtensionRepository';

export function extensionRepository(database:OperationDatabase):ExtensionRepository { return new PgExtensionRepository(database); }
