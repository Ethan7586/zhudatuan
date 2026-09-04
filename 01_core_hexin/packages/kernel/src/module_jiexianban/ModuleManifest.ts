export type ModuleId = string;
export type CapabilityId = string;

export type ModuleKind = 'business' | 'platform' | 'extension' | 'composition';
export type ModuleLayer = 'public' | 'domain' | 'application' | 'adapters' | 'interface' | 'tests';

export interface ModuleEntrypoints {
  readonly http?: readonly string[];
  readonly jobs?: readonly string[];
  readonly consumers?: readonly string[];
}

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
  readonly operations?: readonly string[];
  readonly publishes?: readonly string[];
  readonly consumes?: readonly string[];
  readonly publicEntry?: string;
  readonly layers?: readonly ModuleLayer[];
  readonly entrypoints?: ModuleEntrypoints;
}

export function defineModuleManifest<const T extends ModuleManifest>(manifest: T): T {
  return manifest;
}
