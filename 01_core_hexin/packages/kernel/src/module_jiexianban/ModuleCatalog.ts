import type { CapabilityId, ModuleId, ModuleManifest } from './ModuleManifest';

export interface ModuleSelection {
  readonly modules: readonly ModuleId[];
  readonly bindings?: Readonly<Record<CapabilityId, ModuleId>>;
}

export interface ResolvedModulePlan {
  readonly modules: readonly ModuleManifest[];
  readonly providers: ReadonlyMap<CapabilityId, ModuleId>;
}

/**
 * Immutable registry for capability-based module composition.
 *
 * Resolution is performed once during startup. Runtime calls can keep using the
 * existing dependency container, so module discovery adds no request-time cost.
 */
export class ModuleCatalog {
  readonly #modulesById: ReadonlyMap<ModuleId, ModuleManifest>;
  readonly #providerIdsByCapability: ReadonlyMap<CapabilityId, readonly ModuleId[]>;

  constructor(manifests: readonly ModuleManifest[]) {
    const modulesById = new Map<ModuleId, ModuleManifest>();
    const providerIdsByCapability = new Map<CapabilityId, ModuleId[]>();

    for (const manifest of manifests) {
      if (modulesById.has(manifest.id)) {
        throw new Error(`Duplicate module id: ${manifest.id}`);
      }
      modulesById.set(manifest.id, manifest);

      for (const capability of manifest.provides) {
        const providerIds = providerIdsByCapability.get(capability) ?? [];
        providerIds.push(manifest.id);
        providerIdsByCapability.set(capability, providerIds);
      }
    }

    this.#modulesById = modulesById;
    this.#providerIdsByCapability = providerIdsByCapability;
  }

  all(): readonly ModuleManifest[] {
    return [...this.#modulesById.values()];
  }

  get(moduleId: ModuleId): ModuleManifest | undefined {
    return this.#modulesById.get(moduleId);
  }

  providersFor(capability: CapabilityId): readonly ModuleManifest[] {
    return (this.#providerIdsByCapability.get(capability) ?? []).map((moduleId) =>
      this.requiredModule(moduleId),
    );
  }

  resolve(selection: ModuleSelection): ResolvedModulePlan {
    const selectedIds = new Set(selection.modules);
    const bindings = selection.bindings ?? {};
    const providers = new Map<CapabilityId, ModuleId>();
    const states = new Map<ModuleId, 'visiting' | 'visited'>();
    const ordered: ModuleManifest[] = [];

    const selectProvider = (capability: CapabilityId): ModuleId => {
      const boundProviderId = bindings[capability];
      if (boundProviderId !== undefined) {
        const boundProvider = this.requiredModule(boundProviderId);
        if (!boundProvider.provides.includes(capability)) {
          throw new Error(`Module ${boundProviderId} does not provide capability: ${capability}`);
        }
        providers.set(capability, boundProviderId);
        selectedIds.add(boundProviderId);
        return boundProviderId;
      }

      const candidates = this.#providerIdsByCapability.get(capability) ?? [];
      const selectedCandidates = candidates.filter((moduleId) => selectedIds.has(moduleId));
      const usableCandidates = selectedCandidates.length > 0 ? selectedCandidates : candidates;

      if (usableCandidates.length === 0) {
        throw new Error(`Missing provider for capability: ${capability}`);
      }
      if (usableCandidates.length > 1) {
        throw new Error(
          `Ambiguous providers for capability ${capability}: ${usableCandidates.join(', ')}`,
        );
      }

      const providerId = usableCandidates[0]!;
      providers.set(capability, providerId);
      selectedIds.add(providerId);
      return providerId;
    };

    const visit = (moduleId: ModuleId): void => {
      const state = states.get(moduleId);
      if (state === 'visited') return;
      if (state === 'visiting') {
        throw new Error(`Circular module dependency at: ${moduleId}`);
      }

      const manifest = this.requiredModule(moduleId);
      states.set(moduleId, 'visiting');

      for (const capability of manifest.requires ?? []) {
        visit(selectProvider(capability));
      }

      for (const capability of manifest.optional ?? []) {
        const selectedProviders = (this.#providerIdsByCapability.get(capability) ?? []).filter(
          (providerId) => selectedIds.has(providerId),
        );
        const boundProvider = bindings[capability];
        if (boundProvider !== undefined || selectedProviders.length === 1) {
          visit(selectProvider(capability));
        }
      }

      states.set(moduleId, 'visited');
      ordered.push(manifest);
    };

    for (const moduleId of selection.modules) visit(moduleId);

    return { modules: ordered, providers };
  }

  private requiredModule(moduleId: ModuleId): ModuleManifest {
    const manifest = this.#modulesById.get(moduleId);
    if (manifest === undefined) throw new Error(`Unknown module id: ${moduleId}`);
    return manifest;
  }
}
