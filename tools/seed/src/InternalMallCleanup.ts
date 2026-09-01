import type { Client, PoolClient } from 'pg';

import { INTERNAL_MALL_PREFIX, INTERNAL_MALL_SOURCE } from './InternalMallFixtures';

export async function internalMallCounts(database: Client | PoolClient): Promise<Readonly<Record<string, number>>> {
  const result = await database.query<{ readonly domain: string; readonly count: string }>(`
    select 'organizations' domain,count(*)::text count from organization.organization where id like 'itht:%'
    union all select 'partners',count(*)::text from partner.partner where id like 'itht:%'
    union all select 'members',count(*)::text from member.profile where id like 'itht:%'
    union all select 'products',count(*)::text from catalog.product where id like 'itht:%'
    union all select 'skus',count(*)::text from catalog.sku where id like 'itht:%'
    union all select 'listings',count(*)::text from catalog.listing where id like 'itht:%'
    union all select 'cards',count(*)::text from voucher.voucher where id like 'itht:%'
    union all select 'coupons',count(*)::text from marketing.redemption where id like 'itht:%'
    union all select 'orders',count(*)::text from ordering.orderrecord where order_number like 'ITHT-%'
    union all select 'order_lines',count(*)::text from ordering.line where id like 'itht:%'
    union all select 'payments',count(*)::text from payment.payment where id like 'itht:%'
    union all select 'fulfillments',count(*)::text from fulfillment.fulfillmentorder where id like 'itht:%'
    union all select 'aftersales',count(*)::text from ordering.aftersale where id like 'itht:%'
    union all select 'refunds',count(*)::text from payment.refund where id like 'itht:%'
    union all select 'finance_journals',count(*)::text from finance.journal where scope_id like 'itht:%'
    union all select 'reconciliations',count(*)::text from finance.reconciliation where id like 'itht:%'
    union all select 'provider_operations',count(*)::text from channel.provideroperation where id like 'itht:%'`);
  return Object.freeze(Object.fromEntries(result.rows.map(({ domain, count }) => [domain, Number(count)])));
}

export async function cleanupInternalMallDataset(database: Client | PoolClient): Promise<void> {
  const immutableTriggers = [
    ['finance.entry', 'finance_entry_immutable'],
    ['finance.journal', 'finance_journal_immutable'],
    ['finance.settlementline', 'finance_settlementline_immutable'],
  ] as const;
  for (const [table, trigger] of immutableTriggers) await database.query(`alter table ${table} disable trigger ${trigger}`);
  const statements = [
    `delete from reporting.projectionevent where event_id like 'itht:%'`,
    `delete from reporting.fact where scope_id like 'itht:%'`,
    `delete from reporting.financeprojection where statement_id like 'itht:%'`,
    `delete from reporting.orderprojection where order_id like 'itht:%'`,
    `delete from reporting.export where id like 'itht:%'`,
    `delete from runtime.inbox where consumer='internal-hongtai-dataset'`,
    `delete from runtime.outbox where id like 'itht:%' or scope_id like 'itht:%'`,
    `delete from runtime.idempotency where scope like 'itht:%' or key like 'ITHT-%'`,
    `delete from runtime.rawenvelope where provider=$1`,
    `delete from runtime.reconciliationevidence where id like 'itht:%'`,
    `delete from runtime.reconciliationhash where id like 'itht:%'`,
    `delete from channel.statement where id like 'itht:%'`,
    `delete from channel.webhookinbox where id like 'itht:%'`,
    `delete from channel.sourcerecord where id like 'itht:%'`,
    `delete from channel.externalobject where id like 'itht:%'`,
    `delete from channel.provideroperation where id like 'itht:%'`,
    `delete from channel.connection where id like 'itht:%'`,
    `delete from finance.settlementadjustment where id like 'itht:%'`,
    `delete from finance.split where id like 'itht:%'`,
    `delete from finance.settlementline where id like 'itht:%'`,
    `delete from finance.settlement where id like 'itht:%'`,
    `delete from finance.reconciliationitem where id like 'itht:%'`,
    `delete from finance.statementline where id like 'itht:%'`,
    `delete from finance.reconciliation where id like 'itht:%'`,
    `delete from finance.statement where id like 'itht:%'`,
    `delete from finance.policy where id like 'itht:%'`,
    `delete from finance.period where scope_id like 'itht:%'`,
    `delete from verification.attempt where id like 'itht:%'`,
    `delete from verification.nonce where session_id like 'itht:%'`,
    `delete from verification.session where id like 'itht:%'`,
    `delete from verification.device where id like 'itht:%'`,
    `delete from fulfillment.returnrecord where id like 'itht:%'`,
    `delete from fulfillment.milestone where id like 'itht:%'`,
    `delete from fulfillment.line where fulfillment_id like 'itht:%'`,
    `delete from fulfillment.fulfillmentorder where id like 'itht:%'`,
    `delete from payment.providerattempt where id like 'itht:%'`,
    `delete from payment.refundtender where refund_id like 'itht:%'`,
    `delete from payment.refund where id like 'itht:%'`,
    `delete from payment.effect where id like 'itht:%'`,
    `delete from payment.observation where id like 'itht:%'`,
    `delete from payment.attempt where id like 'itht:%'`,
    `delete from payment.allocation where payment_id like 'itht:%'`,
    `delete from payment.payment where id like 'itht:%'`,
    `delete from payment.prepay where intent_id like 'itht:%'`,
    `delete from payment.intenttender where intent_id like 'itht:%'`,
    `delete from payment.intent where id like 'itht:%'`,
    `delete from payment.tender where id like 'itht:%'`,
    `delete from ordering.reviewaction where id like 'itht:%'`,
    `delete from ordering.aftersale where id like 'itht:%'`,
    `delete from ordering.reminder where id like 'itht:%'`,
    `delete from ordering.stateevent where order_id like 'itht:%'`,
    `delete from ordering.line where id like 'itht:%'`,
    `delete from ordering.suborder where id like 'itht:%'`,
    `delete from ordering.orderrecord where order_number like 'ITHT-%'`,
    `delete from marketing.redemption where id like 'itht:%'`,
    `delete from marketing.campaign where id like 'itht:%'`,
    `delete from checkout.evidence where checkout_id like 'itht:%'`,
    `delete from checkout.session where id like 'itht:%'`,
    `delete from checkout.address where id like 'itht:%'`,
    `delete from inventory.movement where stockitem_id like 'itht:%'`,
    `delete from inventory.reservation where id like 'itht:%' or stockitem_id like 'itht:%'`,
    `delete from inventory.snapshot where stockitem_id like 'itht:%'`,
    `delete from inventory.stockitem where id like 'itht:%'`,
    `delete from pricing.price where id like 'itht:%'`,
    `delete from pricing.pricebook where id like 'itht:%'`,
    `delete from catalog.listing where id like 'itht:%'`,
    `delete from catalog.poolbinding where pool_id like 'itht:%' or mall_id like 'itht:%'`,
    `delete from catalog.poolitem where pool_id like 'itht:%' or sku_id like 'itht:%'`,
    `delete from catalog.pool where id like 'itht:%'`,
    `delete from catalog.sku where id like 'itht:%'`,
    `delete from catalog.product where id like 'itht:%'`,
    `delete from catalog.category where id like 'itht:%'`,
    `delete from voucher.reversal where id like 'itht:%'`,
    `delete from voucher.redemption where id like 'itht:%'`,
    `delete from voucher.reserve where id like 'itht:%'`,
    `delete from voucher.statusevent where voucher_id like 'itht:%'`,
    `delete from voucher.voucher where id like 'itht:%'`,
    `delete from voucher.card where id like 'itht:%'`,
    `delete from voucher.allocation where id like 'itht:%'`,
    `delete from voucher.issuebatch where id like 'itht:%'`,
    `delete from voucher.reserverequest where id like 'itht:%'`,
    `delete from voucher.cardpool where id like 'itht:%'`,
    `delete from voucher.programversion where program_id like 'itht:%'`,
    `delete from voucher.program where id like 'itht:%'`,
    `delete from benefit.reservation where id like 'itht:%' or account_id like 'itht:%'`,
    `delete from benefit.lotmovement where id like 'itht:%' or lot_id like 'itht:%'`,
    `delete from benefit.lot where id like 'itht:%'`,
    `delete from benefit.grantdecision where batch_id like 'itht:%'`,
    `delete from benefit.action where id like 'itht:%'`,
    `delete from benefit.grantitem where batch_id like 'itht:%'`,
    `delete from benefit.grantbatch where id like 'itht:%'`,
    `delete from benefit.budget where id like 'itht:%'`,
    `delete from benefit.planversion where plan_id like 'itht:%'`,
    `delete from benefit.plan where id like 'itht:%'`,
    `delete from benefit.account where id like 'itht:%'`,
    `delete from finance.entry where journal_id in(select id from finance.journal where scope_id like 'itht:%')`,
    `delete from finance.journal where scope_id like 'itht:%'`,
    `delete from finance.account where scope_id like 'itht:%'`,
    `delete from access.membershiprole where membership_id like 'itht:%'`,
    `delete from access.scopegrant where id like 'itht:%' or membership_id like 'itht:%'`,
    `delete from access.membership where id like 'itht:%'`,
    `delete from access.rolepermission where role_id like 'itht:%'`,
    `delete from access.role where id like 'itht:%'`,
    `delete from identity.authticket where session_id in(select id from identity.session where principal_id like 'itht:%')`,
    `delete from identity.session where principal_id like 'itht:%'`,
    `delete from identity.challengedelivery where challenge_id in(select id from identity.challenge where principal_id like 'itht:%')`,
    `delete from identity.challengesecret where challenge_id in(select id from identity.challenge where principal_id like 'itht:%')`,
    `delete from identity.challenge where principal_id like 'itht:%'`,
    `delete from identity.assurance where principal_id like 'itht:%'`,
    `delete from identity.federatedidentity where principal_id like 'itht:%'`,
    `delete from identity.credential where principal_id like 'itht:%'`,
    `delete from member.profile where id like 'itht:%'`,
    `delete from identity.principal where id like 'itht:%'`,
    `delete from partner.servicebinding where store_id like 'itht:%' or organization_id like 'itht:%'`,
    `delete from partner.relationship where id like 'itht:%'`,
    `delete from partner.store where id like 'itht:%'`,
    `delete from partner.partner where id like 'itht:%'`,
    `delete from experience.binding where application_id like 'itht:%' or mall_id like 'itht:%' or pool_id like 'itht:%'`,
    `delete from experience.publication where application_id like 'itht:%'`,
    `delete from experience.release where application_id like 'itht:%'`,
    `update experience.application set head_version_id=null where id like 'itht:%'`,
    `delete from experience.version where application_id like 'itht:%'`,
    `delete from experience.application where id like 'itht:%'`,
    `delete from organization.assignment where parent_id like 'itht:%' or child_id like 'itht:%'`,
    `delete from organization.unitclosure where ancestor_id like 'itht:%' or descendant_id like 'itht:%'`,
    `delete from organization.organization where id like 'itht:%'`,
  ] as const;
  for (const statement of statements) await database.query(statement, statement.includes('$1') ? [INTERNAL_MALL_SOURCE] : []);
  for (const [table, trigger] of immutableTriggers) await database.query(`alter table ${table} enable trigger ${trigger}`);
}

export function internalMallPrefix(): string {
  return INTERNAL_MALL_PREFIX;
}
