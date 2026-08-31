import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { EnrollmentRepository } from '../../application/port/EnrollmentRepository';

export class PgEnrollmentRepository implements EnrollmentRepository {
  async findPrincipal(database: OperationDatabase, subjectHash: string): Promise<string | null> {
    await database.query('select pg_advisory_xact_lock(hashtext($1))', [subjectHash]);
    const result = await database.query<{ principal_id: string }>(
      `select principal_id from identity.credential
      where subject_hash=$1 and status='active' order by principal_id limit 1`,
      [subjectHash]
    );
    return result.rows[0]?.principal_id ?? null;
  }

  async createPrincipal(database: OperationDatabase, principal: string): Promise<void> {
    await database.query(
      `insert into identity.principal(id,status,created_at,updated_at,version)
      values($1,'pending',clock_timestamp(),clock_timestamp(),1)`,
      [principal]
    );
  }

  async activatePrincipal(database: OperationDatabase, principal: string): Promise<void> {
    const result = await database.query(
      `update identity.principal set status='active',version=version+1,updated_at=clock_timestamp()
      where id=$1 and status='pending' returning id`,
      [principal]
    );
    if (!result.rows[0]) throw new DomainError('REGISTRATION_REJECTED');
  }

  async createPassword(database: OperationDatabase, principal: string, subjectHash: string, secretHash: string): Promise<void> {
    await database.query(
      `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at)
      values($1,$2,'password',$3,$4,'active',clock_timestamp())`,
      [`credential:${randomUUID()}`, principal, subjectHash, secretHash]
    );
  }
}
