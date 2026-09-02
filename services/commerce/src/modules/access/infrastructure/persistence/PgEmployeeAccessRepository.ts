import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgAccessMembershipRepository } from './PgAccessMembershipRepository';

export class PgEmployeeAccessRepository extends PgAccessMembershipRepository {
  async createStorefrontMembership(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      member: string;
      principal: string;
      organization: string;
      issuer: string;
      issuerAccessVersion: number;
      employeeNo: string | null;
      department: string | null;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    if (input.employeeNo !== null) {
      await database.query('select pg_advisory_xact_lock(hashtext($1))', [`${input.organization}:storefront:${input.employeeNo}`]);
      const conflict = await database.query(
        `select 1 from access.membership where organization_id=$1 and client='storefront'
        and employee_no=$2 and status in('invited','active','suspended') limit 1`,
        [input.organization, input.employeeNo]
      );
      if (conflict.rows[0]) throw new DomainError('EMPLOYEE_NUMBER_CONFLICT');
    }
    const created = await database
      .query(
        `insert into access.membership(id,member_id,principal_id,organization_id,client,status,
        employee_no,access_version)
        select $1,$2,$3,$4,'storefront','invited',$5,1
        where exists(select 1 from access.membership issuer where issuer.id=$6 and issuer.status='active'
          and issuer.access_version=$7) returning id`,
        [input.membership, input.member, input.principal, input.organization, input.employeeNo, input.issuer, input.issuerAccessVersion]
      )
      .catch((cause: unknown) => {
        if (databaseConstraint(cause) === 'access_membership_employee_unique') throw new DomainError('EMPLOYEE_NUMBER_CONFLICT');
        throw cause;
      });
    if (!created.rows[0]) throw new DomainError('INVITATION_STALE');
    const roles = await database.query(
      `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      select $1,role.id,clock_timestamp(),$2 from access.role role
      where role.id in('role-zhudatuan-storefront-member','role:self') and role.status='active'
      returning role_id`,
      [input.membership, input.issuer]
    );
    if (roles.rows.length !== 2) throw new DomainError('INVITATION_STALE');
    await database.query(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,
      access_version) values($1,$2,'mall',$3,$3,'allow',clock_timestamp(),1),
      ($4,$2,'owner',$5,$5,'allow',clock_timestamp(),1),($6,$2,'self',$7,$7,'allow',clock_timestamp(),1)`,
      [`scope:${input.membership}:mall`, input.membership, input.organization, `scope:${input.membership}:owner`, input.member, `scope:${input.membership}:self`, `self:${input.principal}`]
    );
    if (input.department !== null) {
      await database.query(
        `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
        values($1,$2,'department',$3,$3,'allow',clock_timestamp(),1)`,
        [`scope:${input.membership}:department`, input.membership, input.department]
      );
    }
  }

  async pendingMember(context: ReadTransactionContext, membership: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{ member_id: string }>(
      `select member_id from access.membership
      where id=$1 and status='invited'`,
      [membership]
    );
    return result.rows[0]?.member_id ?? null;
  }

  async pendingEmployee(context: ReadTransactionContext, membership: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{ member: string; organization: string; employee_no: string | null; department: string | null }>(
      `select membership.member_id member,membership.organization_id organization,membership.employee_no,
      (select grantrow.scope_id from access.scopegrant grantrow
        where grantrow.membership_id=membership.id and grantrow.scope_kind='department'
          and grantrow.effect='allow' and grantrow.revoked_at is null
          and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
        order by grantrow.effective_at desc,grantrow.id limit 1) department
      from access.membership membership where membership.id=$1 and membership.status='invited' and membership.client='storefront'`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ member: row.member, organization: row.organization, employeeNo: row.employee_no, department: row.department }) : null;
  }
}

function databaseConstraint(value: unknown): string | undefined {
  return value !== null && typeof value === 'object' && Reflect.get(value, 'code') === '23505' ? String(Reflect.get(value, 'constraint') ?? '') : undefined;
}
