import { createPublicKey, verify } from 'node:crypto';

import { manifestPayload, type ProviderManifest } from '@shop/contract';
import { token } from './Container';

export interface ManifestVerifier {
  verify(manifest: ProviderManifest): Promise<boolean>;
}

export const MANIFEST_VERIFIER = token<ManifestVerifier>('extension.manifestverifier');

export class SignatureVerifier implements ManifestVerifier {
  private readonly key;

  constructor(publicKey: string) {
    this.key = createPublicKey(publicKey);
  }

  verify(manifest: ProviderManifest): Promise<boolean> {
    return Promise.resolve(verify(null, Buffer.from(manifestPayload(manifest)), this.key, Buffer.from(manifest.signature, 'base64')));
  }
}
