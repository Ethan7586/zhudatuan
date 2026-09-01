import type { ManifestVerifier } from '../../../bootstrap/SignatureVerifier';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { InstallExtension } from '../application/service/InstallExtension';
import type { EnableExtension } from '../application/service/EnableExtension';
import type { DisableExtension } from '../application/service/DisableExtension';
import type { ExtensionLoader, ExtensionRepository } from '../application/port/ExtensionLoader';

export type InstallExtensionPort = Pick<InstallExtension, 'execute' | 'reconfigure'>;
export type EnableExtensionPort = Pick<EnableExtension, 'test' | 'enable'>;
export type DisableExtensionPort = Pick<DisableExtension, 'execute'>;

export interface ChannelExtensionPort {
  readonly repository: ExtensionRepository;
  install(verifier: ManifestVerifier, loader: ExtensionLoader): InstallExtensionPort;
  enable(): EnableExtensionPort;
  disable(): DisableExtensionPort;
}

export const CHANNEL_EXTENSION_PORT = publicPort<ChannelExtensionPort>('extension', 'channel');
