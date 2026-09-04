import { token } from '../../bootstrap/Container';

export interface CipherEnvelope {
  readonly ciphertext: string;
  readonly fingerprint: string;
  readonly keyVersion: string;
}

export type KmsPurpose = 'cachehmac' | 'evidence' | 'pii' | 'providerconfig';

export interface KmsClient {
  encrypt(purpose: KmsPurpose, keyRef: string, plaintext: string, context: Readonly<Record<string, string>>): Promise<CipherEnvelope>;
  decrypt(purpose: KmsPurpose, keyRef: string, ciphertext: string, context: Readonly<Record<string, string>>): Promise<string>;
}

export const KMS_CLIENT = token<KmsClient>('kms.client');
