export type ModuleId = string;
export type CapabilityId = string;

export type ModuleKind = 'business' | 'platform' | 'extension';

/**
 * A module describes only its public capabilities and dependencies.
 * Business modules must not expose their internal files through this contract.
 */
export interface ModuleManifest {
  readonly id: ModuleId;
  readonly version: string;
  readonly kind: ModuleKind;
  readonly provides: readonly CapabilityId[];
  readonly requires?: readonly CapabilityId[];
  readonly optional?: readonly CapabilityId[];
}

export function defineModuleManifest<const T extends ModuleManifest>(manifest: T): T {
  return manifest;
}
