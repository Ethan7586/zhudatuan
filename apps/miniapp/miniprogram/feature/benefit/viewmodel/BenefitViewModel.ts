import { bindAccountsRead, bindLedgersRead } from '@shop/sdk/benefit';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { displayItem, displayPage, money } from '../../../shared/Display';

export const benefitViewModel = defineMiniappFeature({
  defaultRoute: 'miniappbenefits', routes: ['miniappbenefits'], title: '福利账户', description: '福利余额、冻结金额与有效批次清晰可核对。',
  connect: (executor) => connectMiniappClient({ benefit: { accountsRead: bindAccountsRead(executor), ledgersRead: bindLedgersRead(executor) } }),
  read: async (client, context) => {
    const [accounts, ledger] = await Promise.all([
      client.benefit.accountsRead({ query: { limit: 30 } }, context),
      client.benefit.ledgersRead({ query: { limit: 30 } }, context),
    ]);
    return Object.freeze({ accounts, ledger });
  },
  project: (value) => {
    const source = value as BenefitSnapshot;
    return displayPage(
      source.accounts.items.map((item) => displayItem(item.id, `${benefitKind(item.kind)}账户`, `可用 ${money(item.available_minor, item.currency)} · 冻结 ${money(item.frozen_minor, item.currency)}`, item.status)),
      source.ledger.items.map((item) => displayItem(item.id, item.description || '福利账户变动', `${item.amountMinor >= 0 ? '入账' : '支出'} ${money(Math.abs(item.amountMinor), item.currency)}`, item.kind, item.occurredAt))
    );
  },
});

interface BenefitSnapshot {
  readonly accounts: OperationOutputFor<'benefit.accounts.read'>;
  readonly ledger: OperationOutputFor<'benefit.ledgers.read'>;
}

function benefitKind(kind: OperationOutputFor<'benefit.accounts.read'>['items'][number]['kind']): string {
  return kind === 'welfare' ? '通用福利' : kind === 'meal' ? '餐补' : '津贴';
}
