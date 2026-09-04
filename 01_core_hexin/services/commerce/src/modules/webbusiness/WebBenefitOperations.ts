import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess } from '../../foundation/application/ModuleOperations';
import { keysetResult, queryPage } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { WEB_BENEFIT_OPERATION_IDS } from './WebBusinessOperationIds';

export function webBenefitOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('benefit', pool, context.container.get(AUDIT_SINK), {
    'benefit.accounts.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select account.id,account.kind,account.currency,balance.available_minor::float8 available_minor,
        balance.reserved_minor::float8 reserved_minor,account.version,
        coalesce((select jsonb_agg(jsonb_build_object('id',lot.id,'remainingMinor',lot.remaining_minor,'effectiveAt',lot.effective_at,
          'expiresAt',lot.expires_at,'state',lot.state) order by lot.effective_at,lot.id) from benefit.lot lot where lot.account_id=account.id
          and lot.state in('pending','active')),'[]'::jsonb) lots
        from benefit.web_account_balance($1,$2) balance join benefit.account account on account.id=balance.account_id
        where ($3::text is null or (account.kind,account.id)>($3,$4))
        order by account.kind,account.id limit $5`, [access.membership.id, access.actor.session, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'kind');
    },
    'benefit.ledgers.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(`select ledger.id,ledger.account_id account,ledger.kind,ledger.currency,
        ledger.amount_minor::float8 "amountMinor",ledger.reference_type "referenceType",ledger.reference_id "referenceId",
        ledger.description,ledger.occurred_at "occurredAt" from benefit.web_ledger($1,$2) ledger
        where ($3::timestamptz is null or (ledger.occurred_at,ledger.id)<($3::timestamptz,$4))
        order by ledger.occurred_at desc,ledger.id desc limit $5`,
      [access.membership.id, access.actor.session, page.sort, page.id, page.fetch]);
      return keysetResult(result, page, 'occurredAt');
    },
  }, WEB_BENEFIT_OPERATION_IDS);
}
