import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
export class FederationCleanupJob implements JobProcessor {
  constructor(private readonly pool: DatabasePool) {}
  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'federationcleanup') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(`update identity.federationtransaction set status='expired',
      verifier_ciphertext='[RETIRED]',return_target_ref='[RETIRED]',version=version+1,updated_at=clock_timestamp()
      where expires_at<=clock_timestamp() and status in('created','redirected','callbackreceived','verified','selectionrequired') and consumed_at is null`);
      await client.query(`delete from identity.preauth where coalesce(consumed_at,expires_at)<clock_timestamp()-interval '1 day'`);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}
