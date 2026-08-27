import { token } from '../../bootstrap/Container';
import { HttpClient } from '../http/HttpClient';

export interface SecretStore {
  read(reference: string): Promise<string>;
}

export const SECRET_STORE = token<SecretStore>('secret.store');

export interface SecurityKeys {
  readonly identity: string;
  readonly quote: string;
  readonly session: string;
}

export const SECURITY_KEYS = token<SecurityKeys>('security.keys');

export class WorkloadSecretStore implements SecretStore {
  private readonly http: HttpClient;
  constructor(private readonly endpoint: string, fetcher: typeof fetch = fetch) {
    if (!endpoint.startsWith('https://')) throw new Error('SECRET_STORE_ENDPOINT_INVALID');
    this.http = new HttpClient(fetcher);
  }

  async read(reference: string): Promise<string> {
    if (!/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(reference)) throw new Error('SECRET_REFERENCE_INVALID');
    const response = await this.http.send(`${this.endpoint.replace(/\/$/, '')}/v1/secrets/${encodeURIComponent(reference)}`, {
      headers: { accept: 'application/json' },
      redirect: 'error',
    }, { mode: 'read' });
    if (!response.ok) throw new Error('SECRET_READ_FAILED');
    const value = await response.json() as { value?: unknown };
    if (typeof value.value !== 'string' || value.value.length === 0) throw new Error('SECRET_VALUE_INVALID');
    return value.value;
  }
}
