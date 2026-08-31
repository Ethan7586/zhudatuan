import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { AssuranceRepository, NewAssurance } from '../../application/port/AssuranceRepository';

export class PgAssuranceRepository implements AssuranceRepository {
  async record(database: OperationDatabase, value: NewAssurance): Promise<void> {
    const days = value.expiresIn === '365days' ? 365 : 0;
    const minutes = value.expiresIn === '15minutes' ? 15 : value.expiresIn === '10minutes' ? 10 : 0;
    await database.query(
      `insert into identity.assurance(id,principal_id,method,level,evidence_hash,verified_at,expires_at)
      values($1,$2,$3,$4,$5,clock_timestamp(),clock_timestamp()+make_interval(days=>$6,mins=>$7))`,
      [`assurance:${randomUUID()}`, value.principal, value.method, value.level, value.evidenceHash, days, minutes]
    );
  }
  async expire(database: OperationDatabase, principal: string, method: string): Promise<void> {
    await database.query(
      `update identity.assurance set expires_at=least(coalesce(expires_at,clock_timestamp()),clock_timestamp())
      where principal_id=$1 and method=$2 and (expires_at is null or expires_at>clock_timestamp())`,
      [principal, method]
    );
  }
}
