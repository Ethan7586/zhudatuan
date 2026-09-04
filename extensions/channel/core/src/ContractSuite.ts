import { PROVIDER_PORT_BY_CAPABILITY, type ChannelProvider, type ProviderCapability, type ProviderPortName } from '@shop/contract';

const capabilitiesByPort = (() => {
  const index = new Map<ProviderPortName, ProviderCapability[]>();
  for (const [capability, port] of Object.entries(PROVIDER_PORT_BY_CAPABILITY) as readonly [ProviderCapability, ProviderPortName][]) {
    const capabilities = index.get(port) ?? [];
    capabilities.push(capability);
    index.set(port, capabilities);
  }
  for (const [port, capabilities] of index) index.set(port, Object.freeze(capabilities) as ProviderCapability[]);
  return index;
})();

export function providerCapabilities(port: ProviderPortName): readonly ProviderCapability[] {
  const capabilities = capabilitiesByPort.get(port);
  if (!capabilities) throw new Error('PROVIDER_PORT_UNMAPPED:' + port);
  return capabilities;
}

export function assertInstalledProvider(provider: ChannelProvider): void {
  const uncovered = provider.manifest.capabilities.filter((capability) => {
    const port = PROVIDER_PORT_BY_CAPABILITY[capability];
    return !port || !provider.has(port);
  });
  if (uncovered.length) throw new Error(`PROVIDER_CONTRACT_SUITE_FAILED:${provider.manifest.id}:${uncovered.join(',')}`);
}
