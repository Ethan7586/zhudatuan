import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { IdentityOrganizationPort } from '../../public/IdentityOrganizationPort';
import type { AccessOrganizationPort } from '../../public/AccessOrganizationPort';
export class OrganizationPort implements IdentityOrganizationPort, AccessOrganizationPort {
  private readonly transactions = new PgTransactionAccess();
  async visible(context: ReadTransactionContext, ancestor: string, descendant: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      visible: boolean;
    }>(`select exists(select 1 from organization.unitclosure where ancestor_id=$1 and descendant_id=$2) visible`, [ancestor, descendant]);
    return result.rows[0]?.visible === true;
  }
  async bindingAllowed(context: ReadTransactionContext, root: string, distributor: string, tenant: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      allowed: boolean;
    }>(
      `select exists(
        select 1 from organization.unitclosure root
        join organization.unitclosure child on child.ancestor_id=root.descendant_id
        join organization.organization target on target.id=child.descendant_id and target.kind='tenant'
        where root.ancestor_id=$1 and root.descendant_id=$2 and child.descendant_id=$3
      ) allowed`,
      [root, distributor, tenant]
    );
    return result.rows[0]?.allowed === true;
  }
  async invitationScope(
    context: ReadTransactionContext,
    organization: string
  ): Promise<Readonly<{
    id: string;
    kind: string;
  }> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      kind: string;
    }>(
      `select id,kind from organization.organization
      where id=$1 and status='active'`,
      [organization]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
  async delegationAllowed(
    context: ReadTransactionContext,
    input: Readonly<{
      organization: string;
      allows: readonly string[];
      denies: readonly string[];
    }>
  ): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      allowed: boolean;
    }>(
      `select exists(
        select 1 from organization.unitclosure closure where closure.descendant_id=$1 and closure.ancestor_id=any($2::text[])
      ) and not exists(
        select 1 from organization.unitclosure closure where closure.descendant_id=$1 and closure.ancestor_id=any($3::text[])
      ) allowed`,
      [input.organization, input.allows, input.denies]
    );
    return result.rows[0]?.allowed === true;
  }
  async employeeDepartment(context: ReadTransactionContext, department: string, organization: string): Promise<Readonly<{ id: string; name: string }> | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; name: string }>(
      `select department.id,department.name from organization.organization department
      join organization.unitclosure closure on closure.descendant_id=department.id
      where department.id=$1 and department.kind='department' and department.status='active'
      and closure.ancestor_id=$2 limit 1`,
      [department, organization]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }
  async kind(context: ReadTransactionContext, organization: string): Promise<string> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      kind: string;
    }>(`select kind from organization.organization where id=$1 and status='active'`, [organization]);
    const kind = result.rows[0]?.kind;
    if (!kind) throw new Error('ORGANIZATION_NOT_FOUND');
    return kind;
  }
  async names(
    context: ReadTransactionContext,
    organizations: readonly string[]
  ): Promise<
    readonly Readonly<{
      id: string;
      name: string;
    }>[]
  > {
    const database = this.transactions.database(context);
    if (organizations.length === 0) return Object.freeze([]);
    const result = await database.query<{
      id: string;
      name: string;
    }>(`select id,name from organization.organization where id=any($1::text[]) and status='active' order by name,id`, [[...new Set(organizations)]]);
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async directoryBindings(context: ReadTransactionContext, provider: string, subjecthash: Buffer) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      name: string;
    }>(
      `select link.membership_id id,organization.name
      from organization.directoryconnection connection join organization.directorysubject subject on subject.connection_id=connection.id
      join organization.directorymembership link on link.subject_id=subject.id and link.connection_id=connection.id
      join organization.organization organization on organization.id=link.organization_id and organization.status='active'
      where connection.provider_instance_id=$1 and connection.provider_status='enabled' and subject.subject_hash=$2
        and subject.status='active' and link.status='active' and link.membership_id is not null
      order by organization.name,link.membership_id`,
      [provider, subjecthash]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async createDistributor(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      parent: string;
      name: string;
      timezone: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    const parent = await database.query<{
      id: string;
    }>(
      `select id from organization.organization
      where id=$1 and kind='platform' and status='active' for update`,
      [input.parent]
    );
    if (!parent.rows[0]) throw new Error('DISTRIBUTOR_PARENT_INVALID');
    await database.query(
      `insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at)
      values($1,'distributor',$2,$3,$4,'active',0,clock_timestamp(),clock_timestamp())`,
      [input.id, input.parent, input.name, input.timezone]
    );
    await database.query(
      `insert into organization.unitclosure(ancestor_id,descendant_id,depth)
      select ancestor_id,$1,depth+1 from organization.unitclosure where descendant_id=$2 union all select $1,$1,0`,
      [input.id, input.parent]
    );
  }
  async rename(context: WriteTransactionContext, id: string, name: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update organization.organization set name=$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`,
      [id, name]
    );
    if (!changed.rows[0]) throw new Error('ORGANIZATION_NOT_FOUND');
  }
  async disable(context: WriteTransactionContext, id: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update organization.organization set status='disabled',version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`,
      [id]
    );
    if (!changed.rows[0]) throw new Error('ORGANIZATION_NOT_FOUND');
  }
}
