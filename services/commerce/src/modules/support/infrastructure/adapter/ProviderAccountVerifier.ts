import type { SecretStore } from '../../../../platform/secret/SecretStore';
import { HttpClient } from '../../../../platform/http/HttpClient';
import { DomainError } from '../../../../platform/error/DomainError';
import type { SupportAccountProvider, SupportAccountVerification, SupportAccountVerifier } from '../../application/port/SupportAccountVerifier';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';

interface ProbeCredential {
  readonly endpoint: string;
  readonly bearer: string;
  readonly healthPath: string;
}

export class ProviderAccountVerifier implements SupportAccountVerifier {
  private readonly http: HttpClient;

  constructor(
    private readonly secrets: SecretStore,
    fetcher: typeof fetch = fetch
  ) {
    this.http = new HttpClient(fetcher);
  }

  async verify(input: Readonly<{ provider: SupportAccountProvider; scope: string; secretRef: string | null }>, execution: ExecutionContext<'support.accounts.manage'>): Promise<SupportAccountVerification> {
    const checkedAt = new Date().toISOString();
    if (input.provider === 'inapp') {
      if (input.secretRef !== null) throw invalid();
      return Object.freeze({ secretRef: null, secretVersion: null, state: 'notrequired', code: 'SUPPORT_ACCOUNT_LOCAL', checkedAt });
    }
    if (input.secretRef === null) throw invalid();
    try {
      const material = await this.secrets.resolve(input.secretRef);
      const credential = parseCredential(material.reveal('providerconfig'));
      const response = await this.http.send(
        new URL(credential.healthPath, `${credential.endpoint.replace(/\/$/, '')}/`),
        { method: 'GET', headers: { accept: 'application/json', authorization: `Bearer ${credential.bearer}`, 'x-support-provider': input.provider, 'x-support-scope': input.scope } },
        { mode: 'read', signal: execution.signal, deadline: execution.deadline }
      );
      if (!response.ok) throw new Error('SUPPORT_ACCOUNT_PROBE_REJECTED');
      return Object.freeze({ secretRef: input.secretRef, secretVersion: material.version, state: 'verified', code: 'SUPPORT_ACCOUNT_CONNECTED', checkedAt });
    } catch {
      throw new DomainError('VALIDATION_FAILED', { field: 'secretRef' });
    }
  }
}

function parseCredential(value: string): ProbeCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw invalid();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalid();
  const record = parsed as Record<string, unknown>;
  const allowed = new Set(['endpoint', 'bearer', 'healthPath']);
  if (Object.keys(record).some((key) => !allowed.has(key)) || typeof record.endpoint !== 'string' || typeof record.bearer !== 'string' || record.bearer.length < 16) throw invalid();
  const endpoint = new URL(record.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash || endpoint.search || endpoint.pathname !== '/') throw invalid();
  const healthPath = record.healthPath === undefined ? '/v1/health' : record.healthPath;
  if (typeof healthPath !== 'string' || !/^\/[A-Za-z0-9][A-Za-z0-9/.-]{0,199}$/.test(healthPath)) throw invalid();
  return Object.freeze({ endpoint: endpoint.origin, bearer: record.bearer, healthPath });
}

function invalid(): DomainError {
  return new DomainError('VALIDATION_FAILED', { field: 'secretRef' });
}
