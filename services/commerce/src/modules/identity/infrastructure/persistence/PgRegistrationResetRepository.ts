import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { RegistrationResetReceipt, RegistrationResetRepository, RegistrationResetTarget } from '../../application/port/RegistrationResetRepository';

export class PgRegistrationResetRepository implements RegistrationResetRepository {
  private readonly transactions = new PgTransactionAccess();

  async lock(context: WriteTransactionContext, resource: string): Promise<void> {
    await this.transactions.database(context).query('select pg_advisory_xact_lock(hashtext($1))', [`identity-registration:${resource}`]);
  }

  async target(context: WriteTransactionContext, principal: string, actor: string): Promise<RegistrationResetTarget> {
    if (principal === actor) throw new DomainError('OWNER_MEMBERSHIP_PROTECTED');
    const result = await this.transactions.database(context).query<Readonly<{ id: string; version: number; password_verified: boolean }>>(
      `select target.id,target.version,
      exists(select 1 from identity.assurance proof where proof.principal_id=$2 and proof.method='password'
        and proof.level>=2 and proof.verified_at>clock_timestamp()-interval '10 minutes'
        and (proof.expires_at is null or proof.expires_at>clock_timestamp())) password_verified
      from identity.principal target where target.id=$1 and target.status in('pending','active') for update`,
      [principal, actor]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    if (!row.password_verified) throw new DomainError('STEPUP_REQUIRED');
    return Object.freeze({ principal: row.id, version: Number(row.version), passwordVerified: true });
  }

  async reset(context: WriteTransactionContext, target: RegistrationResetTarget, salt: string): Promise<RegistrationResetReceipt | null> {
    const database = this.transactions.database(context);
    await database.query(
      `update identity.credential set status='revoked',subject_hash=encode(public.digest(id||$2,'sha256'),'hex'),
      secret_hash=null,encrypted_secret=null,rotated_at=clock_timestamp()
      where principal_id=$1`,
      [target.principal, salt]
    );
    await database.query(
      `update identity.federatedidentity set status='revoked',normalized_subject_hash=public.digest(id||$2,'sha256'),
      revoked_at=clock_timestamp(),updated_at=clock_timestamp()
      where principal_id=$1 and status<>'revoked'`,
      [target.principal, salt]
    );
    await database.query(
      `update identity.session set revoked_at=coalesce(revoked_at,clock_timestamp()),revoked_reason=coalesce(revoked_reason,'registration_reset')
      where principal_id=$1 and revoked_at is null`,
      [target.principal]
    );
    const changed = await database.query<Readonly<{ id: string; credential_version: number; version: number }>>(
      `update identity.principal set status='disabled',credential_version=credential_version+1,
      version=version+1,updated_at=clock_timestamp() where id=$1 and version=$2 and status in('pending','active')
      returning id,credential_version,version`,
      [target.principal, target.version]
    );
    const row = changed.rows[0];
    return row ? Object.freeze({ principal: row.id, credentialVersion: Number(row.credential_version), version: Number(row.version) }) : null;
  }
}
