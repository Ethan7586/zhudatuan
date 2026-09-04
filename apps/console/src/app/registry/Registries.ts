import { createApprovalRegistry, type ApprovalRegistryPort } from './ApprovalRegistry';
import { createExtensionRegistry, type ExtensionRegistryPort } from './ExtensionRegistry';
import { createImportRegistry, type ImportRegistryPort } from './ImportRegistry';

export interface ConsoleRegistries {
  readonly approval: ApprovalRegistryPort;
  readonly imports: ImportRegistryPort;
  readonly extensions: ExtensionRegistryPort;
}

export function createConsoleRegistries(): ConsoleRegistries {
  return Object.freeze({ approval: createApprovalRegistry(), imports: createImportRegistry(), extensions: createExtensionRegistry() });
}

export const consoleRegistries = createConsoleRegistries();
