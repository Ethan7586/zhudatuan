import type { ContractJsonObject } from '@shop/contract';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CampaignRecord, CampaignRepository } from '../../application/port/CampaignRepository';
import { Campaign, type CampaignSnapshot } from '../../domain/model/Campaign';
import { CampaignPolicy } from '../../domain/policy/CampaignPolicy';

interface CampaignRow extends Record<string, unknown> {
  readonly id: string;
  readonly scope_id: string;
  readonly kind: CampaignSnapshot['kind'];
  readonly name: string;
  readonly state: CampaignSnapshot['state'];
  readonly budget_minor: number;
  readonly spent_minor: number;
  readonly currency: 'CNY';
  readonly rule: ContractJsonObject;
  readonly effective_at: Date | string;
  readonly expires_at: Date | string | null;
  readonly version: number;
  readonly budget_version: number;
  readonly published_at: Date | string | null;
  readonly disabled_at: Date | string | null;
  readonly disable_reason: string | null;
  readonly created_by: string;
  readonly updated_by: string;
  readonly created_at: Date | string;
  readonly updated_at: Date | string;
}

const columns = `id,scope_id,kind,name,state,budget_minor::float8 budget_minor,spent_minor::float8 spent_minor,currency,rule,
effective_at,expires_at,version::integer,budget_version::integer,published_at,disabled_at,disable_reason,created_by,updated_by,created_at,updated_at`;

export class PgCampaignRepository implements CampaignRepository {
  constructor(
    private readonly transactions = new PgTransactionAccess(),
    private readonly policy = new CampaignPolicy()
  ) {}

  async read(context: ReadTransactionContext, scope: string, cursor: Readonly<{ sort: string | null; id: string | null; fetch: number }>): Promise<readonly CampaignRecord[]> {
    const result = await this.transactions.database(context).query<CampaignRow>(
      `select ${columns} from marketing.campaign where scope_id=$1
       and ($2::timestamptz is null or (updated_at,id)<($2::timestamptz,$3)) order by updated_at desc,id desc limit $4`,
      [scope, cursor.sort, cursor.id, cursor.fetch]
    );
    return Object.freeze(result.rows.map(record));
  }

  async create(context: WriteTransactionContext, input: Parameters<CampaignRepository['create']>[1]): Promise<CampaignRecord> {
    const campaign = Campaign.draft({ id: input.id, scope: input.scope, ...input.revision, createdBy: input.actor }, new Date()).snapshot();
    const result = await this.transactions.database(context).query<CampaignRow>(
      `insert into marketing.campaign(id,scope_id,kind,name,state,budget_minor,spent_minor,currency,rule,effective_at,expires_at,
       version,budget_version,published_at,disabled_at,disable_reason,created_by,updated_by,created_at,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) returning ${columns}`,
      values(campaign)
    );
    const row = result.rows[0];
    if (!row) throw new Error('MARKETING_CAMPAIGN_CREATE_FAILED');
    return record(row);
  }

  revise(context: WriteTransactionContext, scope: string, id: string, expectedVersion: number, revision: Parameters<CampaignRepository['revise']>[4]): Promise<CampaignRecord | null> {
    return this.mutate(context, scope, id, expectedVersion, (campaign) => campaign.revise(expectedVersion, revision, new Date()));
  }

  publish(context: WriteTransactionContext, scope: string, id: string, expectedVersion: number, actor: string): Promise<CampaignRecord | null> {
    return this.mutate(context, scope, id, expectedVersion, (campaign) => {
      this.policy.assertPublishable(campaign, new Date());
      return campaign.publish(expectedVersion, actor, new Date());
    });
  }

  disable(context: WriteTransactionContext, scope: string, id: string, expectedVersion: number, actor: string, reason: string): Promise<CampaignRecord | null> {
    return this.mutate(context, scope, id, expectedVersion, (campaign) => campaign.disable(expectedVersion, actor, reason, new Date()));
  }

  private async mutate(context: WriteTransactionContext, scope: string, id: string, expectedVersion: number, change: (campaign: Campaign) => Campaign): Promise<CampaignRecord | null> {
    const database = this.transactions.database(context);
    const loaded = await database.query<CampaignRow>(`select ${columns} from marketing.campaign where id=$1 and scope_id=$2 for update`, [id, scope]);
    const row = loaded.rows[0];
    if (!row) return null;
    const campaign = change(Campaign.restore(snapshot(row))).snapshot();
    const result = await database.query<CampaignRow>(
      `update marketing.campaign set kind=$3,name=$4,state=$5,budget_minor=$6,currency=$7,rule=$8::jsonb,effective_at=$9,
       expires_at=$10,version=$11,published_at=$12,disabled_at=$13,disable_reason=$14,updated_by=$15,updated_at=$16
       where id=$1 and scope_id=$2 and version=$17 returning ${columns}`,
      [
        id,
        scope,
        campaign.kind,
        campaign.name,
        campaign.state,
        campaign.budgetMinor,
        campaign.currency,
        JSON.stringify(campaign.rule),
        campaign.effectiveAt,
        campaign.expiresAt,
        campaign.version,
        campaign.publishedAt,
        campaign.disabledAt,
        campaign.disableReason,
        campaign.updatedBy,
        campaign.updatedAt,
        expectedVersion,
      ]
    );
    return result.rows[0] ? record(result.rows[0]) : null;
  }
}

export function campaignSnapshot(row: CampaignRow): CampaignSnapshot {
  const rule = row.rule as unknown as CampaignSnapshot['rule'];
  return Object.freeze({
    id: row.id,
    scope: row.scope_id,
    kind: row.kind,
    name: row.name,
    state: row.state,
    budgetMinor: Number(row.budget_minor),
    spentMinor: Number(row.spent_minor),
    budgetVersion: Number(row.budget_version),
    currency: row.currency,
    rule,
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
  });
}
function snapshot(row: CampaignRow): CampaignSnapshot {
  return Campaign.restore(campaignSnapshot(row)).snapshot();
}
function record(row: CampaignRow): CampaignRecord {
  const value = snapshot(row);
  return Object.freeze({
    id: value.id,
    scope_id: value.scope,
    kind: value.kind,
    name: value.name,
    state: value.state,
    budget_minor: value.budgetMinor,
    spent_minor: value.spentMinor,
    available_minor: value.budgetMinor - value.spentMinor,
    currency: value.currency,
    rule: value.rule,
    effective_at: value.effectiveAt,
    expires_at: value.expiresAt,
    version: value.version,
    budget_version: value.budgetVersion,
    published_at: value.publishedAt,
    disabled_at: value.disabledAt,
    disable_reason: value.disableReason,
    created_by: value.createdBy,
    updated_by: value.updatedBy,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  });
}
function values(value: CampaignSnapshot): readonly unknown[] {
  return [
    value.id,
    value.scope,
    value.kind,
    value.name,
    value.state,
    value.budgetMinor,
    value.spentMinor,
    value.currency,
    JSON.stringify(value.rule),
    value.effectiveAt,
    value.expiresAt,
    value.version,
    value.budgetVersion,
    value.publishedAt,
    value.disabledAt,
    value.disableReason,
    value.createdBy,
    value.updatedBy,
    value.createdAt,
    value.updatedAt,
  ];
}
function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}
function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}
