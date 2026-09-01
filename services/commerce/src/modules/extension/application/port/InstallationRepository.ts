import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProviderManifest } from '@shop/contract';

export interface InstallationListItem extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly extension_id: string;
  readonly extension_version: string;
  readonly scope_id: string;
  readonly status: 'disabled' | 'testing' | 'enabled' | 'degraded';
  readonly manifest: ProviderManifest;
  readonly version: number;
  readonly installed_at: string;
  readonly health_state: 'healthy' | 'degraded' | 'unhealthy' | null;
  readonly health_latency_ms: number | null;
  readonly health_reason: string | null;
  readonly checked_at: string | null;
}

export interface InstallationRepository {
  list(context: ReadTransactionContext, cursor: Readonly<{ sort: string | null; id: string | null }>, fetch: number): Promise<readonly InstallationListItem[]>;
}
