import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { ExtensionRuntimeStore, RuntimeInstallation } from '../../application/port/ExtensionRuntimeStore';
import type { ExtensionLoadContext } from '../../application/port/ExtensionLoader';

export class PgExtensionRuntimeStore implements ExtensionRuntimeStore {
  private readonly transactions: PgTransactionManager;
  private readonly access = new PgTransactionAccess();

  constructor(pool: DatabasePool) {
    this.transactions = new PgTransactionManager(pool);
  }

  enabled(signal: AbortSignal, deadline = Date.now() + 30_000): Promise<readonly RuntimeInstallation[]> {
    return this.transactions.read(
      systemOptions(signal, 'load', deadline),
      async (context) =>
        (
          await this.access.database(context).query<RuntimeInstallation>(`select id,extension_id,scope_id,manifest,base_url,endpoints,secret_ref,
        health_operation,version from extension.enabled_installations()`)
        ).rows
    );
  }

  find(installation: string, context: ExtensionLoadContext): Promise<RuntimeInstallation | null> {
    const { workload, ...execution } = context;
    return this.transactions.read<RuntimeInstallation | null>(
      {
        ...execution,
        operation: 'extension.provider.stage',
        ...(workload === 'worker' ? { workload: 'jobs' as const } : {}),
      },
      async (transaction) => {
        const result = await this.access.database(transaction).query<RuntimeInstallation>(
          `select id,extension_id,scope_id,manifest,base_url,endpoints,secret_ref,
         health_operation,version from extension.load_installation($1,$2)`,
          [installation, context.scope]
        );
        return result.rows[0] ?? null;
      }
    );
  }
}

function systemOptions(signal: AbortSignal, action: string, deadline: number) {
  return {
    tenant: '',
    membership: '',
    scope: 'extension',
    actor: 'system:extension',
    trace: `extension:${action}`,
    operation: `extension.provider.${action}`,
    workload: 'jobs' as const,
    deadline,
    signal,
  };
}
