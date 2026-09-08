import { deepFreeze } from '../../../shared/model/Immutable';
import type { FinanceAudit, FinanceFacets, FinanceOverview, FinanceRecord, FinanceRecordPage, FinanceReconciliationPage, FinanceSection } from '../model/Finance';
import { FinanceAuditSchema } from './AuditSchema';
import { FinanceFacetsSchema } from './FacetSchema';
import { FinanceOverviewSchema } from './OverviewSchema';
import { InvoicePageSchema, PolicyPageSchema, ReconciliationPageSchema, WithdrawalPageSchema } from './SectionSchema';
import { FinanceRecordProjection } from './FinanceRecordProjection';

const financeRecordProjection = new FinanceRecordProjection();

export class FinanceMapper {
  audit(value: unknown): FinanceAudit {
    const result = FinanceAuditSchema.parse(value);
    return deepFreeze({
      reference: result.reference,
      facts: result.facts.map((item) => ({ id: item.id, kind: item.kind, label: item.label, businessReference: item.business_reference, state: item.state, amountMinor: item.amount_minor, currency: item.currency, occurredAt: item.occurred_at, version: item.version })),
      events: result.events.map((item) => ({ id: item.id, type: item.type, eventVersion: item.event_version, aggregateType: item.aggregate_type, aggregateId: item.aggregate_id, state: item.state, occurredAt: item.occurred_at, traceId: item.trace_id })),
      records: result.records.map((item) => ({ id: item.id, kind: item.kind, action: item.action, resourceType: item.resource_type, resourceId: item.resource_id, actorId: item.actor_id, actorType: item.actor_type, beforeHash: item.before_hash, afterHash: item.after_hash, recordHash: item.record_hash, evidence: item.evidence, occurredAt: item.occurred_at, traceId: item.trace_id })),
      watermark: result.watermark,
    });
  }

  facets(value: unknown): FinanceFacets {
    return deepFreeze(FinanceFacetsSchema.parse(value));
  }

  overview(value: unknown): FinanceOverview {
    const result = FinanceOverviewSchema.parse(value);
    return deepFreeze({
      items: result.items.map((item) => ({
        currency: item.currency,
        balanceMinor: item.balance_minor,
        liabilityMinor: item.liability_minor,
        incomeMinor: item.income_minor,
        expenseMinor: item.expense_minor,
        cashMinor: item.cash_minor,
        journalCount: item.journal_count,
        watermark: item.watermark,
      })),
    });
  }

  section(section: FinanceSection, value: unknown): FinanceRecordPage {
    if (section === 'entries' || section === 'statements' || section === 'reconciliations' || section === 'settlements') return financeRecordProjection.map(section, value);
    switch (section) {
      case 'withdrawals': {
        const page = WithdrawalPageSchema.parse(value);
        return this.page(page, (row) => ({
          id: row.id, label: '提现申请', reference: row.settlement_id, amountMinor: row.amount_minor, currency: row.currency, state: row.state, occurredAt: row.created_at, version: row.version,
          facts: [
            { label: '来源结算单', kind: 'reference', value: row.settlement_id },
            { label: '提现金额', kind: 'money', minor: row.amount_minor, currency: row.currency },
            { label: '收款目标', kind: 'reference', value: row.destination_ref },
            { label: '申请原因', kind: 'text', value: row.reason },
            { label: '申请时间', kind: 'time', value: row.created_at },
            { label: '更新时间', kind: 'time', value: row.updated_at },
            { label: '付款时间', kind: 'time', value: row.paid_at },
            { label: '支付渠道', kind: 'text', value: row.provider },
            { label: '渠道状态', kind: 'text', value: row.provider_state },
          ],
          technicalFacts: [
            { label: '提现编号', kind: 'reference', value: row.id },
            { label: '渠道引用', kind: 'reference', value: row.provider_reference },
            { label: '请求校验值', kind: 'text', value: row.request_hash },
            { label: '响应校验值', kind: 'text', value: row.response_hash },
            { label: '输入水位', kind: 'time', value: row.input_watermark },
          ],
        }));
      }
      case 'invoices': {
        const page = InvoicePageSchema.parse(value);
        return this.page(page, (row) => ({
          id: row.id,
          label: row.kind === 'red' ? '红字发票' : '发票',
          reference: row.id,
          amountMinor: row.amount_minor,
          currency: row.currency,
          state: row.state,
          occurredAt: row.issued_at ?? row.created_at,
          version: row.version,
          facts: [
            { label: '发票类型', kind: 'text', value: row.kind },
            { label: '开票金额', kind: 'money', minor: row.amount_minor, currency: row.currency },
            { label: '来源结算单', kind: 'reference', value: row.settlement_id },
            { label: '发票资料', kind: 'reference', value: row.profile_id },
            { label: '申请原因', kind: 'text', value: row.reason },
            { label: '申请时间', kind: 'time', value: row.created_at },
            { label: '开具时间', kind: 'time', value: row.issued_at },
            { label: '开票渠道', kind: 'text', value: row.provider },
            { label: '发票明细', kind: 'text', value: `${row.lines.length} 条` },
          ],
          technicalFacts: [
            { label: '发票申请编号', kind: 'reference', value: row.id },
            { label: '原发票申请', kind: 'reference', value: row.red_of_request_id },
            { label: '文件引用', kind: 'reference', value: row.object_ref },
            { label: '文件校验值', kind: 'text', value: row.sha256 },
            { label: '渠道引用', kind: 'reference', value: row.provider_reference },
            { label: '来源校验值', kind: 'text', value: row.source_hash },
            { label: '响应校验值', kind: 'text', value: row.response_hash },
          ],
        }));
      }
      case 'policies': {
        const page = PolicyPageSchema.parse(value);
        return this.page(page, (row) => ({
          id: row.id,
          label: row.name,
          reference: row.trigger,
          amountMinor: null,
          currency: null,
          state: row.status,
          occurredAt: row.effectiveAt,
          version: row.version,
          facts: [
            { label: '触发条件', kind: 'text', value: row.trigger },
            { label: '生效时间', kind: 'time', value: row.effectiveAt },
            { label: '失效时间', kind: 'time', value: row.expiresAt },
            { label: '记账规则', kind: 'text', value: `${row.entries.length} 条` },
          ],
          technicalFacts: [{ label: '规则编号', kind: 'reference', value: row.id }],
        }));
      }
    }
  }

  reconciliations(value: unknown): FinanceReconciliationPage {
    const page = ReconciliationPageSchema.parse(value);
    return deepFreeze({
      items: page.items.map((row) => ({
        id: row.id,
        scopeId: row.scope_id,
        provider: row.provider,
        partnerId: row.partner_id,
        period: row.period,
        statementRef: row.statement_ref,
        statementHash: row.statement_hash,
        debitMinor: row.debit_minor,
        creditMinor: row.credit_minor,
        differenceMinor: row.difference_minor,
        state: row.state,
        evidence: row.evidence,
        createdBy: row.created_by,
        approvedBy: row.approved_by,
        updatedAt: row.updated_at,
        version: row.version,
        itemCounts: row.item_counts,
        items: row.items.map((item) => ({
          id: item.id,
          externalMinor: item.externalMinor,
          internalMinor: item.internalMinor,
          differenceMinor: item.differenceMinor,
          state: item.state,
          reasonCode: item.reasonCode,
          evidence: item.evidence,
          resolution: item.resolution,
          resolvedBy: item.resolvedBy,
          approvedBy: item.approvedBy,
        })),
      })),
      count: page.count,
      ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
    });
  }

  private page<T>(page: Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>, map: (item: T) => FinanceRecord): FinanceRecordPage {
    return deepFreeze({ items: page.items.map(map), count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }
}
