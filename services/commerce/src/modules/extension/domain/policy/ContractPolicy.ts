import { manifestPayload, PROVIDER_API_VERSION, type ProviderManifest, type UnsignedProviderManifest } from '@shop/contract';

export class ContractPolicy {
  assert(actual: ProviderManifest, expected: UnsignedProviderManifest): void {
    if (actual.apiVersion !== PROVIDER_API_VERSION) throw new Error('EXTENSION_API_VERSION_MISMATCH');
    if (manifestPayload(actual) !== manifestPayload({ ...expected, signature: actual.signature })) throw new Error('EXTENSION_CONTRACT_MISMATCH');
  }
}
