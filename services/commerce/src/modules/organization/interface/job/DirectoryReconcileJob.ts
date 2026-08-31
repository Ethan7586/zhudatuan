import { createHash } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import { LeaseStore } from '../../../../foundation/infrastructure/LeaseStore';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';

export class DirectoryReconcileJob implements JobProcessor {
  private readonly leases: LeaseStore;
  constructor(
    private readonly pool: DatabasePool,
    private readonly leaseSeconds: number
  ) {
    this.leases = new LeaseStore(pool);
  }
  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== 'directoryreconcile') throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const lease = await this.leases.acquire('directory:reconcile', job.id, this.leaseSeconds);
    if (!lease) throw new Error('DIRECTORY_RECONCILE_LEASE_BUSY');
    try {
      const anomalies = await this.pool.query<{ connection: string; code: string; count: string }>(`select connection.id::text connection,'missingtwice' code,count(*)::text count
      from organization.directoryconnection connection join organization.directorysubject subject on subject.connection_id=connection.id
      where connection.status='enabled' and subject.missing_count>=2 and subject.status='active' group by connection.id
      union all select connection.id::text,'conflict',count(*)::text from organization.directoryconnection connection
      join organization.directorysubject subject on subject.connection_id=connection.id where connection.status='enabled' and subject.status='conflict' group by connection.id`);
      for (const anomaly of anomalies.rows) {
        const source = `directory:${digest(`${anomaly.connection}:${anomaly.code}:${new Date().toISOString().slice(0, 10)}`)}`;
        await this.pool.query(
          `insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at)
          values($1,'directoryreconcile',$2,'organization',jsonb_build_object('connectionhash',$3,'count',$4),$5,1,clock_timestamp())
          on conflict(kind,source_id) do update set payload=excluded.payload,failed_at=excluded.failed_at,reviewed_at=null`,
          [`alert:${source}`, source, digest(anomaly.connection), Number(anomaly.count), `DIRECTORY_${anomaly.code.toUpperCase()}`]
        );
      }
    } finally {
      await this.leases.release(lease);
    }
  }
}
function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
