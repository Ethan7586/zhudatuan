import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type {
  CreateCustomerCommand,
  CustomerLock,
  CustomerProjection,
  CustomerRepository,
  CustomerWriteResult,
  UpdateCustomerCommand,
} from '../../application/port/CustomerRepository';

interface CustomerRow extends Omit<CustomerProjection, 'createdAt' | 'updatedAt'> {
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
}

const projection = `select customer.id,customer.scope_id as "scopeId",customer.identifier_masked as "identifierMasked",customer.name,customer.kind,customer.status,
  customer.version::integer,customer.created_at as "createdAt",customer.updated_at as "updatedAt",
  coalesce((select jsonb_agg(jsonb_build_object('id',contact.id,'kind',contact.kind,'nameMasked',contact.name_masked,
    'phoneMasked',contact.phone_masked,'emailMasked',contact.email_masked,'configured',true,'version',contact.version::integer) order by contact.kind)
    from partner.customercontact contact where contact.customer_id=customer.id),'[]'::jsonb) contacts,
  case when agreement.id is null then null else jsonb_build_object('id',agreement.id,'contractRef',agreement.contract_ref,'contractHash',agreement.contract_hash,
    'capabilities',agreement.capabilities,'status',case when agreement.status='active' and agreement.expires_at<=clock_timestamp() then 'expired' else agreement.status end,
    'effectiveAt',agreement.effective_at,'expiresAt',agreement.expires_at,'version',agreement.version::integer) end agreement
  from partner.customer customer
  left join lateral(select current.id,current.contract_ref,current.contract_hash,current.capabilities,current.status,current.effective_at,current.expires_at,current.version
    from partner.customeragreement current where current.customer_id=customer.id order by current.version desc limit 1) agreement on true`;

export class PgCustomerRepository implements CustomerRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async list(context: ReadTransactionContext, input: Parameters<CustomerRepository['list']>[1]): Promise<readonly CustomerProjection[]> {
    const result = await this.transactions.database(context).query<CustomerRow>(
      `${projection} where customer.scope_id=$1 and ($2::text is null or customer.name ilike '%'||$2||'%' or customer.id=$2)
        and ($3::text is null or customer.kind=$3) and ($4::text is null or customer.status=$4)
        and ($5::timestamptz is null or (customer.updated_at,customer.id)<($5::timestamptz,$6))
        order by customer.updated_at desc,customer.id desc limit $7`,
      [input.scope, input.q, input.kind, input.status, input.sort, input.id, input.fetch]
    );
    return result.rows.map(customerProjection);
  }

  async get(context: ReadTransactionContext, scope: string, id: string): Promise<CustomerProjection | null> {
    const result = await this.transactions.database(context).query<CustomerRow>(`${projection} where customer.scope_id=$1 and customer.id=$2`, [scope, id]);
    return result.rows[0] ? customerProjection(result.rows[0]) : null;
  }

  async create(context: WriteTransactionContext, command: CreateCustomerCommand): Promise<CustomerProjection | 'identifierconflict'> {
    const database = this.transactions.database(context);
    const inserted = await database.query(
      `insert into partner.customer(id,tenant_id,scope_id,identifier_ciphertext,identifier_hash,identifier_key_version,identifier_masked,name,kind,status,version,created_by,updated_by,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft',1,$10,$10,clock_timestamp(),clock_timestamp()) on conflict(tenant_id,identifier_hash) do nothing returning id`,
      [command.id, command.tenant, command.scope, command.identifier.ciphertext, command.identifier.fingerprint, command.identifier.keyVersion, command.identifierMasked, command.name, command.kind, command.actor]
    );
    if (!inserted.rows[0]) return 'identifierconflict';
    await this.saveContact(context, command.id, command.tenant, command.scope, command.contact, command.actor);
    if (command.agreement) await this.saveAgreement(context, command.id, command.tenant, command.scope, command.agreement, command.actor);
    return (await this.get(context, command.scope, command.id))!;
  }

  async update(context: WriteTransactionContext, command: UpdateCustomerCommand): Promise<CustomerWriteResult> {
    const database = this.transactions.database(context);
    let updated;
    try {
      updated = await database.query<{ tenant: string }>(
        `update partner.customer set
          identifier_ciphertext=case when $4 then $5 else identifier_ciphertext end,
          identifier_hash=case when $4 then $6 else identifier_hash end,
          identifier_key_version=case when $4 then $7 else identifier_key_version end,
          identifier_masked=case when $4 then $8 else identifier_masked end,
          name=coalesce($9,name),kind=coalesce($10,kind),version=version+1,updated_by=$11,updated_at=clock_timestamp()
         where id=$1 and scope_id=$2 and version=$3 returning tenant_id tenant`,
        [command.id, command.scope, command.expectedVersion, command.identifier !== undefined, command.identifier?.ciphertext ?? null, command.identifier?.fingerprint ?? null, command.identifier?.keyVersion ?? null, command.identifierMasked ?? null, command.name ?? null, command.kind ?? null, command.actor]
      );
    } catch (cause) {
      if (databaseCode(cause) === '23505') return 'identifierconflict';
      throw cause;
    }
    const selected = updated.rows[0];
    if (!selected) {
      const exists = await database.query(`select 1 from partner.customer where id=$1 and scope_id=$2`, [command.id, command.scope]);
      return exists.rows[0] ? 'versionconflict' : 'notfound';
    }
    if (command.contact) await this.saveContact(context, command.id, selected.tenant, command.scope, command.contact, command.actor);
    if (command.agreement) await this.saveAgreement(context, command.id, selected.tenant, command.scope, command.agreement, command.actor);
    return (await this.get(context, command.scope, command.id))!;
  }

  async lock(context: WriteTransactionContext, scope: string, id: string): Promise<CustomerLock | null> {
    const result = await this.transactions.database(context).query<CustomerLock>(
      `select customer.id,customer.name,customer.kind,customer.status,customer.version::integer,
        exists(select 1 from partner.customeragreement agreement where agreement.customer_id=customer.id and agreement.status='active'
          and agreement.effective_at<=clock_timestamp() and agreement.expires_at>clock_timestamp()) as "agreementEffective"
       from partner.customer customer where customer.id=$1 and customer.scope_id=$2 for update`,
      [id, scope]
    );
    return result.rows[0] ?? null;
  }

  async setState(context: WriteTransactionContext, input: Parameters<CustomerRepository['setState']>[1]): Promise<CustomerProjection | null> {
    const result = await this.transactions.database(context).query(
      `update partner.customer set status=$4,version=version+1,updated_by=$5,updated_at=clock_timestamp()
       where id=$1 and scope_id=$2 and version=$3 and status=$6 returning id`,
      [input.id, input.scope, input.expectedVersion, input.target, input.actor, input.current]
    );
    return result.rows[0] ? this.get(context, input.scope, input.id) : null;
  }

  async options(context: ReadTransactionContext, input: Parameters<CustomerRepository['options']>[1]) {
    const result = await this.transactions.database(context).query<{ id: string; name: string; kind: 'enterprise' | 'institution' | 'government'; agreementExpiresAt: Date | string; version: number }>(
      `select customer.id,customer.name,customer.kind,agreement.expires_at as "agreementExpiresAt",customer.version::integer
       from partner.customer customer join partner.customeragreement agreement on agreement.customer_id=customer.id
       where customer.scope_id=$1 and customer.status='active' and agreement.status='active' and agreement.effective_at<=clock_timestamp() and agreement.expires_at>clock_timestamp()
         and ($2::text is null or customer.name ilike '%'||$2||'%' or customer.id=$2)
       order by customer.name,customer.id limit $3`,
      [input.scope, input.q, input.limit]
    );
    return result.rows.map((row) => Object.freeze({ ...row, agreementExpiresAt: iso(row.agreementExpiresAt) }));
  }

  async approved(context: ReadTransactionContext, customer: string, scope: string) {
    const result = await this.transactions.database(context).query<{ id: string; scope: string; name: string; kind: 'enterprise' | 'institution' | 'government'; agreementVersion: number; agreementExpiresAt: Date | string }>(
      `select customer.id,customer.scope_id scope,customer.name,customer.kind,agreement.version::integer as "agreementVersion",agreement.expires_at as "agreementExpiresAt"
       from partner.customer customer join partner.customeragreement agreement on agreement.customer_id=customer.id
       where customer.id=$1 and customer.scope_id=$2 and customer.status='active' and agreement.status='active'
         and agreement.effective_at<=clock_timestamp() and agreement.expires_at>clock_timestamp()`,
      [customer, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ ...row, agreementExpiresAt: iso(row.agreementExpiresAt) }) : null;
  }

  private async saveContact(context: WriteTransactionContext, customer: string, tenant: string, scope: string, contact: CreateCustomerCommand['contact'], actor: string): Promise<void> {
    await this.transactions.database(context).query(
      `insert into partner.customercontact(id,tenant_id,scope_id,customer_id,kind,name_ciphertext,name_hash,name_key_version,name_masked,phone_ciphertext,phone_hash,phone_key_version,phone_masked,email_ciphertext,email_hash,email_key_version,email_masked,version,created_by,updated_by,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,1,$18,$18,clock_timestamp(),clock_timestamp())
       on conflict(customer_id,kind) do update set name_ciphertext=excluded.name_ciphertext,name_hash=excluded.name_hash,name_key_version=excluded.name_key_version,name_masked=excluded.name_masked,
         phone_ciphertext=excluded.phone_ciphertext,phone_hash=excluded.phone_hash,phone_key_version=excluded.phone_key_version,phone_masked=excluded.phone_masked,
         email_ciphertext=excluded.email_ciphertext,email_hash=excluded.email_hash,email_key_version=excluded.email_key_version,email_masked=excluded.email_masked,
         version=partner.customercontact.version+1,updated_by=excluded.updated_by,updated_at=clock_timestamp()`,
      [contact.id, tenant, scope, customer, contact.kind, contact.name.ciphertext, contact.name.fingerprint, contact.name.keyVersion, contact.nameMasked, contact.phone?.ciphertext ?? null, contact.phone?.fingerprint ?? null, contact.phone?.keyVersion ?? null, contact.phoneMasked, contact.email?.ciphertext ?? null, contact.email?.fingerprint ?? null, contact.email?.keyVersion ?? null, contact.emailMasked, actor]
    );
  }

  private async saveAgreement(context: WriteTransactionContext, customer: string, tenant: string, scope: string, agreement: NonNullable<CreateCustomerCommand['agreement']>, actor: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update partner.customeragreement set status=case when expires_at<=clock_timestamp() then 'expired' else 'terminated' end,updated_by=$2,updated_at=clock_timestamp()
       where customer_id=$1 and status in('draft','active')`,
      [customer, actor]
    );
    await database.query(
      `insert into partner.customeragreement(id,tenant_id,scope_id,customer_id,contract_ref,contract_hash,capabilities,status,effective_at,expires_at,version,created_by,updated_by,created_at,updated_at)
       select $1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,coalesce(max(version),0)+1,$11,$11,clock_timestamp(),clock_timestamp()
       from partner.customeragreement where customer_id=$4`,
      [agreement.id, tenant, scope, customer, agreement.contractRef, agreement.contractHash, JSON.stringify(agreement.capabilities), agreement.status, agreement.effectiveAt, agreement.expiresAt, actor]
    );
  }
}

function customerProjection(row: CustomerRow): CustomerProjection {
  return Object.freeze({
    ...row,
    contacts: Object.freeze(row.contacts.map((contact) => Object.freeze({ ...contact }))),
    agreement:
      row.agreement === null
        ? null
        : Object.freeze({ ...row.agreement, capabilities: Object.freeze([...row.agreement.capabilities]), effectiveAt: iso(row.agreement.effectiveAt), expiresAt: iso(row.agreement.expiresAt) }),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  });
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function databaseCode(cause: unknown): string | undefined {
  return cause !== null && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string' ? cause.code : undefined;
}
