import type { DirectoryLease } from '../port/DirectoryJobRepository';
import type { DirectorySynchronization } from '../service/DirectorySynchronization';

export interface DirectorySyncExecution {
  readonly trace: string;
  readonly scope: string;
  readonly attempts: number;
  readonly signal: AbortSignal;
  readonly deadline: number;
}

export class SynchronizeDirectory {
  constructor(
    private readonly leases: DirectoryLease,
    private readonly synchronization: DirectorySynchronization,
    private readonly leaseSeconds: number,
    private readonly maximumAttempts: number
  ) {}

  execute(connection: string, run: string, execution: DirectorySyncExecution): Promise<void> {
    return this.leases.run(execution.scope, `directory:${connection}`, execution.trace, this.leaseSeconds, async (assertLease) => {
      try {
        await this.synchronization.execute(connection, run, execution.trace, execution.signal, execution.deadline, assertLease);
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'DIRECTORY_SYNC_CANCELLED') return;
        if (execution.attempts >= this.maximumAttempts && !execution.signal.aborted && execution.deadline > Date.now()) {
          await this.synchronization.fail(run, cause, execution.trace, execution.signal, execution.deadline);
        }
        throw cause;
      }
    });
  }
}
