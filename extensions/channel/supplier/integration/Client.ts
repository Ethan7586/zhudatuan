import type { LocalProviderInstallation, ProviderProbe } from '@shop/providercore';

export class SupplierClient implements ProviderProbe {
  constructor(private readonly local: LocalProviderInstallation) {}
  health(): Promise<boolean> {
    return this.local.health();
  }
  circuitState() {
    return 'closed' as const;
  }
}
