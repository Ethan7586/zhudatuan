import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import { randomUUID } from 'node:crypto';
import type { LinkCaseRepository } from '../../application/port/LinkCaseRepository';
import { LinkCase, type LinkCaseReason } from '../../domain/model/LinkCase';
export class PgLinkCaseRepository implements LinkCaseRepository {
  private readonly transactions = new PgTransactionAccess();
  async create(context: WriteTransactionContext, provider: string, tenant: string, subjecthash: Buffer, reason: LinkCaseReason, transaction?: string): Promise<LinkCase> {
    const database = this.transactions.database(context);
    const id = randomUUID();
    const result = await database.query<{
      id: string;
      reason: LinkCaseReason;
      status: 'open';
      decision_by: null;
      checked_by: null;
      version: number;
    }>(
      `insert into identity.linkcase(id,provider_id,transaction_id,tenant_id,subject_hash,reason,status,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,'open',0,clock_timestamp(),clock_timestamp())
      returning id,reason,status,decision_by,checked_by,version`,
      [id, provider, transaction ?? null, tenant, subjecthash, reason]
    );
    const row = result.rows[0]!;
    return new LinkCase(row.id, row.reason, row.status, row.decision_by, row.checked_by, row.version);
  }
  async enrollment(context: WriteTransactionContext, organization: string, reference: string, subjecthash: Buffer, candidatePrincipal: string | null): Promise<LinkCase> {
    const database = this.transactions.database(context);
    const id = randomUUID();
    const result = await database.query<{
      id: string;
      reason: 'subjectconflict';
      status: 'open';
      decision_by: null;
      checked_by: null;
      version: number;
    }>(
      `insert into identity.linkcase(id,provider_id,transaction_id,tenant_id,organization_id,reference_id,source,subject_hash,
      candidate_principal_id,reason,status,version,created_at,updated_at) values($1,null,null,null,$2,$3,'enrollment',$4,$5,
      'subjectconflict','open',1,clock_timestamp(),clock_timestamp()) on conflict(source,organization_id,reference_id,subject_hash)
      where source='enrollment' and status='open' do update set updated_at=clock_timestamp(),version=identity.linkcase.version+1
      returning id,reason,status,decision_by,checked_by,version`,
      [id, organization, reference, subjecthash, candidatePrincipal]
    );
    const row = result.rows[0]!;
    return new LinkCase(row.id, row.reason, row.status, row.decision_by, row.checked_by, Number(row.version));
  }
  async decide(context: ReadTransactionContext, value: LinkCase): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update identity.linkcase set status=$2,decision_by=$3,checked_by=$4,decided_at=clock_timestamp(),
      version=version+1,updated_at=clock_timestamp() where id=$1 and version=$5 and status='open'`,
      [value.id, value.status, value.decisionby, value.checkedby, value.version - 1]
    );
    if (result.rowCount !== 1) throw new DomainError('FEDERATION_LINK_CONFLICT');
  }
}
