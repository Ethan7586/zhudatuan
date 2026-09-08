import type { ContractJsonObject } from '@shop/contract';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { Campaign, type CampaignSnapshot } from '../../domain/model/Campaign';
import { PromotionRule } from '../../domain/model/Promotion';
import { CampaignPolicy } from '../../domain/policy/CampaignPolicy';
import { PromotionStacking } from '../../domain/policy/PromotionStacking';
import type { MarketingEvaluation, MarketingEvaluationInput, MarketingReadPort } from '../../public';

interface CampaignRow {
  readonly id: string;
  readonly scope_id: string;
  readonly kind: CampaignSnapshot['kind'];
  readonly name: string;
  readonly state: CampaignSnapshot['state'];
  readonly budget_minor: number;
  readonly spent_minor: number;
  readonly budget_version: number;
  readonly currency: 'CNY';
  readonly rule: ContractJsonObject;
  readonly effective_at: Date | string;
  readonly expires_at: Date | string | null;
  readonly version: number;
  readonly published_at: Date | string | null;
  readonly disabled_at: Date | string | null;
  readonly disable_reason: string | null;
  readonly created_by: string;
  readonly updated_by: string;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

export class PgMarketingReadPort implements MarketingReadPort {
  constructor(
    private readonly transactions = new PgTransactionAccess(),
    private readonly policy = new CampaignPolicy(),
    private readonly stacking = new PromotionStacking()
  ) {}

  async evaluate(context: ReadTransactionContext, input: MarketingEvaluationInput): Promise<MarketingEvaluation> {
    if (input.currency !== 'CNY' || !Number.isSafeInteger(input.subtotalMinor) || input.subtotalMinor < 0) throw new Error('MARKETING_EVALUATION_INVALID');
    const rows = await this.transactions.database(context).query<CampaignRow>(
      `select id,scope_id,kind,name,state,budget_minor::float8 budget_minor,spent_minor::float8 spent_minor,
       budget_version::integer,currency,rule,effective_at,expires_at,version::integer,published_at,disabled_at,disable_reason,
       created_by,updated_by,created_at,updated_at from marketing.campaign where scope_id=$1 and state in('scheduled','active')
       and effective_at<=clock_timestamp() and (expires_at is null or expires_at>clock_timestamp()) and spent_minor<budget_minor order by id`,
      [input.scope]
    );
    const contextValue = Object.freeze({
      channel: input.channel,
      memberTags: input.memberTags,
      qualificationStates: input.qualificationStates,
      productIds: input.productIds,
      categoryIds: input.categoryIds,
      listingIds: input.listingIds,
      at: new Date(),
    });
    const candidates = rows.rows.flatMap((row) => {
      const campaign = restore(row);
      if (!this.policy.eligible(campaign, contextValue)) return [];
      const promotion = PromotionRule.create(campaign.rule.promotion);
      const discountMinor = promotion.discount(input.subtotalMinor, campaign.budgetMinor - campaign.spentMinor);
      const value = promotion.snapshot();
      return discountMinor === 0 ? [] : [{ value: campaign, id: campaign.id, priority: value.priority, group: value.exclusiveGroup, stackable: value.stackable, discountMinor }];
    });
    const selected = this.stacking.select(candidates);
    let remaining = input.subtotalMinor;
    const evidence = selected.flatMap((candidate) => {
      const discount = Math.min(candidate.discountMinor, remaining);
      remaining -= discount;
      return discount === 0 ? [] : [Object.freeze({ id: candidate.value.id, version: candidate.value.version, discount })];
    });
    return Object.freeze({ amountMinor: input.subtotalMinor - remaining, evidence: Object.freeze(evidence) });
  }

  async references(context: ReadTransactionContext, campaigns: readonly string[]) {
    if (campaigns.length === 0) return Object.freeze({ ready: true, version: 'none' });
    const ids = Object.freeze([...new Set(campaigns)].sort());
    const result = await this.transactions.database(context).query<{ count: number; version: string | null }>(
      `select count(*)::integer count,string_agg(id||'@'||version,',' order by id) version from marketing.campaign
       where id=any($1::text[]) and state in('scheduled','active') and effective_at<=clock_timestamp()
       and (expires_at is null or expires_at>clock_timestamp())`,
      [ids]
    );
    return Object.freeze({ ready: result.rows[0]?.count === ids.length, version: result.rows[0]?.version ?? 'none' });
  }
}

function restore(row: CampaignRow): CampaignSnapshot {
  return Campaign.restore({
    id: row.id,
    scope: row.scope_id,
    kind: row.kind,
    name: row.name,
    state: row.state,
    budgetMinor: Number(row.budget_minor),
    spentMinor: Number(row.spent_minor),
    budgetVersion: Number(row.budget_version),
    currency: row.currency,
    rule: row.rule as unknown as CampaignSnapshot['rule'],
    effectiveAt: iso(row.effective_at),
    expiresAt: nullableIso(row.expires_at),
    version: Number(row.version),
    publishedAt: nullableIso(row.published_at),
    disabledAt: nullableIso(row.disabled_at),
    disableReason: row.disable_reason,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }).snapshot();
}
function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}
