import type { ManifestVerifier } from '../../../bootstrap/SignatureVerifier';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { InstallExtension } from '../application/command/InstallExtension';
import type { EnableExtension } from '../application/command/EnableExtension';
import type { DisableExtension } from '../application/command/DisableExtension';
import type { ExtensionLoader, ExtensionRepositoryFactory } from '../application/port/ExtensionLoader';

export type InstallExtensionPort = Pick<InstallExtension, 'execute' | 'reconfigure'>;
export type EnableExtensionPort = Pick<EnableExtension, 'test' | 'enable'>;
export type DisableExtensionPort = Pick<DisableExtension, 'execute'>;

export interface ChannelExtensionPort {
  readonly repositories: ExtensionRepositoryFactory;
  install(verifier: ManifestVerifier, loader: ExtensionLoader): InstallExtensionPort;
  enable(): EnableExtensionPort;
  disable(): DisableExtensionPort;
}

export const CHANNEL_EXTENSION_PORT = publicPort<ChannelExtensionPort>('extension', 'channel');
