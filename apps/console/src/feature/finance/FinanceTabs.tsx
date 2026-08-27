import { useNavigate } from 'react-router';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { scopePath } from '../../shared/url/ScopePath';
import type { FinanceTab } from './FinanceWorkspaceSchema';

interface FinanceTabItem {
  readonly key: FinanceTab | 'settlements' | 'entries';
  readonly label: string;
  readonly suffix: string;
}

const tabs: readonly FinanceTabItem[] = Object.freeze([
  { key: 'payments', label: '支付对账', suffix: 'finance?tab=payments' },
  { key: 'refunds', label: '退款对账', suffix: 'finance?tab=refunds' },
  { key: 'settlements', label: '结算单', suffix: 'finance/settlements' },
  { key: 'entries', label: '账本分录', suffix: 'finance/entries' },
  { key: 'rules', label: '对账规则', suffix: 'finance?tab=rules' },
  { key: 'audit', label: '审计记录', suffix: 'finance?tab=audit' },
]);

export function FinanceTabs({ context, active }: Readonly<{ context: ConsoleContext; active: FinanceTabItem['key'] | undefined }>) {
  const navigate = useNavigate();
  return (
    <nav className="financetabs" aria-label="财务工作台">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-current={active === tab.key ? 'page' : undefined}
          onClick={() => {
            void navigate(`${scopePath(context.scope, tab.suffix.split('?')[0]!)}${tab.suffix.includes('?') ? `?${tab.suffix.split('?')[1]}` : ''}`);
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export type FinanceWorkspaceTab = FinanceTabItem['key'];
