import { defineModule } from '../../bootstrap/DefinedModule';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { referralRoutes } from './interface/http/ReferralRoutes';
import { Manifest } from './Manifest';
import { REFERRAL_READ_PORT, REFERRAL_WRITE_PORT, type ReferralReadPort, type ReferralWritePort } from './public';
import { readDatabaseWorkload, writeDatabaseWorkload } from '../../foundation/persistence/Workload';

export const ReferralModule = defineModule(Manifest, referralRoutes, (context) => {
  const pool = context.service(DATABASE_POOL);
  const reads = pool.workload(readDatabaseWorkload(context.workload));
  const writes = pool.workload(writeDatabaseWorkload(context.workload));
  const read: ReferralReadPort = {
    async binding(scopeId, customerId) {
      const result = await reads.query<{ promoter_id: string; version: number }>(`select promoter_id,version from referral.binding where scope_id=$1 and customer_id=$2`, [scopeId, customerId]);
      const row = result.rows[0];
      return row ? Object.freeze({ promoterId: row.promoter_id, version: row.version }) : null;
    },
  };
  const write: ReferralWritePort = {
    async accept(event) {
      const result = await writes.query(
        `insert into runtime.inbox(consumer,event_id,event_type,event_version,trace_id,payload,received_at)
        values('job:referralevent',$1,$2,1,$1,$3::jsonb,clock_timestamp()) on conflict(consumer,event_id) do nothing`,
        [event.eventId, event.eventType, JSON.stringify(event.payload)]
      );
      return result.rowCount === 1;
    },
  };
  return [
    { token: REFERRAL_READ_PORT, value: read },
    { token: REFERRAL_WRITE_PORT, value: write },
  ];
});
