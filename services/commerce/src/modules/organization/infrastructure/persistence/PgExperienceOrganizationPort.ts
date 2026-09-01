import { randomUUID } from 'node:crypto';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ExperienceOrganizationPort } from '../../public/ExperienceOrganizationPort';

export class PgExperienceOrganizationPort implements ExperienceOrganizationPort {
  private readonly transactions = new PgTransactionAccess();

  async createMall(context: WriteTransactionContext, input: Readonly<{ parent: string; name: string }>): Promise<string> {
    const database = this.transactions.database(context);
    const selected = await database.query<{ id: string; timezone: string }>(
      `select id,timezone from organization.organization
      where id=$1 and kind in('tenant','enterprise') and status='active' for key share`,
      [input.parent]
    );
    const parent = selected.rows[0];
    if (!parent) throw new DomainError('VALIDATION_FAILED', { field: 'scope' });
    return this.insert(database, parent.id, parent.timezone, input.name);
  }

  async copyMall(context: WriteTransactionContext, input: Readonly<{ source: string; name: string }>): Promise<string> {
    const database = this.transactions.database(context);
    const selected = await database.query<{ parent_id: string; timezone: string }>(
      `select parent_id,timezone from organization.organization
      where id=$1 and kind='mall' and status='active' and parent_id is not null for key share`,
      [input.source]
    );
    const source = selected.rows[0];
    if (!source) throw new DomainError('RESOURCE_NOT_FOUND');
    return this.insert(database, source.parent_id, source.timezone, input.name);
  }

  private async insert(database: ReturnType<PgTransactionAccess['database']>, parent: string, timezone: string, name: string): Promise<string> {
    const id = `mall:${randomUUID()}`;
    await database.query(
      `insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
      values($1,'mall',$2,$3,$4,'active',0,clock_timestamp(),clock_timestamp())`,
      [id, parent, name, timezone]
    );
    await database.query(
      `insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      select ancestor_id,$1,depth+1 from organization.unitclosure where descendant_id=$2
      union all select $1,$1,0`,
      [id, parent]
    );
    return id;
  }
}
