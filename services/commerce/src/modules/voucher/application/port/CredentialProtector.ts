export interface CredentialBinding {
  readonly scope: string;
  readonly pool: string;
  readonly credential: string;
}

export interface ProtectedCredential {
  readonly ciphertext: string;
  readonly fingerprint: string;
  readonly masked: string;
  readonly keyVersion: string;
}

export interface CredentialProtector {
  protect(value: string, purpose: 'number' | 'secret', binding: CredentialBinding): Promise<ProtectedCredential>;
  reveal(ciphertext: string, purpose: 'number' | 'secret', binding: CredentialBinding): Promise<string>;
  fingerprint(value: string, purpose: 'number' | 'secret', scope: string): Promise<string>;
}
