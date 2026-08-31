import type { DirectoryProvider } from '../port/DirectoryProvider';
export class DirectoryProviderRegistry {
  private readonly values: ReadonlyMap<string, DirectoryProvider>;
  constructor(providers: readonly DirectoryProvider[]) {
    const values = new Map<string, DirectoryProvider>();
    for (const provider of providers) {
      if (values.has(provider.type)) throw new Error(`DIRECTORY_PROVIDER_DUPLICATE:${provider.type}`);
      values.set(provider.type, provider);
    }
    if (!values.has('wecomcorp') || !values.has('wecomsuite') || values.size !== 2) throw new Error('DIRECTORY_PROVIDER_REGISTRY_INCOMPLETE');
    this.values = values;
    Object.freeze(this);
  }
  require(type: string): DirectoryProvider {
    const provider = this.values.get(type);
    if (!provider) throw new Error('DIRECTORY_PROVIDER_UNAVAILABLE');
    return provider;
  }
  catalog(): readonly string[] {
    return Object.freeze([...this.values.keys()].sort());
  }
}
