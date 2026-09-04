import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { CampaignsCreateHandler } from '../application/handler/CampaignsCreateHandler';
import { CampaignsDisableHandler } from '../application/handler/CampaignsDisableHandler';
import { CampaignsPublishHandler } from '../application/handler/CampaignsPublishHandler';
import { CampaignsReviseHandler } from '../application/handler/CampaignsReviseHandler';
import type { CampaignRecord, CampaignRepository } from '../application/port/CampaignRepository';

describe('marketing campaign operation lifecycle', () => {
  it('creates a complete draft from the controlled contract and publishes creation evidence', async () => {
    const create = vi.fn(async (context, input) => record({ id: input.id, created_by: input.actor, updated_by: input.actor }));
    const reply = await new CampaignsCreateHandler(repository({ create })).execute({ body: draftBody() } as never, writeContext('marketing.campaigns.create'));
    expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ scope: 'mall:one', actor: 'principal:test', revision: expect.objectContaining({ name: '新客活动', budgetMinor: 10_000 }) }));
    expect(OPERATION_SCHEMAS['marketing.campaigns.create'].output.parse(reply.body)).toEqual(reply.body);
    expect(reply.events?.[0]).toMatchObject({ type: 'marketing.campaign.created', aggregate: { type: 'campaign', version: 1 } });
  });

  it('revises only the expected draft version and retains a full immutable rule snapshot', async () => {
    const revise = vi.fn(async (_context, _scope, _id, expected, revision) => record({ version: expected + 1, name: revision.name }));
    const reply = await new CampaignsReviseHandler(repository({ revise })).execute({ path: { campaignid: 'campaign:one' }, body: { ...draftBody(), name: '新客活动第二版' } } as never, writeContext('marketing.campaigns.revise', 1));
    expect(revise).toHaveBeenCalledWith(expect.anything(), 'mall:one', 'campaign:one', 1, expect.objectContaining({ updatedBy: 'principal:test' }));
    expect(reply.body).toMatchObject({ name: '新客活动第二版', version: 2, budget_version: 1 });
    expect(reply.events?.[0]).toMatchObject({ type: 'marketing.campaign.revised', aggregate: { version: 2 } });
  });

  it('publishes and disables through explicit versioned commands with auditable reasons', async () => {
    const publish = vi.fn(async (_context, _scope, _id, expected, actor) => record({ state: 'active', version: expected + 1, published_at: '2026-09-05T08:00:00.000Z', updated_by: actor }));
    const published = await new CampaignsPublishHandler(repository({ publish })).execute({ path: { campaignid: 'campaign:one' }, body: {} } as never, writeContext('marketing.campaigns.publish', 1));
    expect(publish).toHaveBeenCalledWith(expect.anything(), 'mall:one', 'campaign:one', 1, 'principal:test');
    expect(published.events?.[0]).toMatchObject({ type: 'marketing.campaign.published', aggregate: { version: 2 } });

    const disable = vi.fn(async (_context, _scope, _id, expected, actor, reason) =>
      record({ state: 'disabled', version: expected + 1, published_at: '2026-09-05T08:00:00.000Z', disabled_at: '2026-09-06T08:00:00.000Z', disable_reason: reason, updated_by: actor })
    );
    const disabled = await new CampaignsDisableHandler(repository({ disable })).execute({ path: { campaignid: 'campaign:one' }, body: { reason: '预算策略调整' } } as never, writeContext('marketing.campaigns.disable', 2));
    expect(disable).toHaveBeenCalledWith(expect.anything(), 'mall:one', 'campaign:one', 2, 'principal:test', '预算策略调整');
    expect(disabled.body).toMatchObject({ state: 'disabled', disable_reason: '预算策略调整', version: 3 });
  });
});

function repository(overrides: Partial<CampaignRepository>): CampaignRepository {
  return {
    read: async () => [],
    create: async () => record(),
    revise: async () => record(),
    publish: async () => record(),
    disable: async () => record(),
    ...overrides,
  };
}

function writeContext(operation: Parameters<typeof readHandlerContext>[0], expectedVersion?: number) {
  return { ...readHandlerContext(operation, {} as WriteTransactionContext), expectedVersion } as never;
}

function draftBody() {
  return {
    kind: 'discount',
    name: '新客活动',
    budgetMinor: 10_000,
    currency: 'CNY',
    effectiveAt: '2026-09-01T00:00:00.000Z',
    expiresAt: '2030-10-01T00:00:00.000Z',
    rule: {
      audience: { memberTags: ['new'], qualificationStates: ['approved'] },
      products: { productIds: ['product:one'], categoryIds: [], listingIds: [] },
      channels: ['web'],
      promotion: { priority: 1, fixedMinor: 500, basisPoints: 0, minimumSubtotal: 1_000, maximumMinor: 500, stackable: true, exclusiveGroup: 'welcome' },
      coupon: null,
    },
  };
}

function record(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
    id: 'campaign:one',
    scope_id: 'mall:one',
    kind: 'discount',
    name: '新客活动',
    state: 'draft',
    budget_minor: 10_000,
    spent_minor: 0,
    available_minor: 10_000,
    currency: 'CNY',
    rule: draftBody().rule,
    effective_at: '2026-09-01T00:00:00.000Z',
    expires_at: '2030-10-01T00:00:00.000Z',
    version: 1,
    budget_version: 1,
    published_at: null,
    disabled_at: null,
    disable_reason: null,
    created_by: 'principal:maker',
    updated_by: 'principal:maker',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  } as CampaignRecord;
}
