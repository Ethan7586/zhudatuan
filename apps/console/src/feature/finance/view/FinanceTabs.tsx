import { Button } from '@shop/design';
import type { FinanceNavigationViewModel } from '../viewmodel/NavigationViewModel';

export function FinanceTabs({ model, onImport }: Readonly<{ model: FinanceNavigationViewModel; onImport?: () => void }>) {
  return (
    <div className="financenavigation">
      <nav className="financetabs" aria-label="财务工作台">
        {model.items.map((tab) => (
          <button key={tab.key} type="button" aria-current={model.active === tab.key ? 'page' : undefined} onClick={() => model.select(tab.route)}>
            {tab.label}
          </button>
        ))}
      </nav>
      {model.canImport && model.active === 'statements' ? (
        <div className="financecontextactions">
          <Button tone="primary" onPress={onImport ?? model.importStatement}>
            导入账单
          </Button>
        </div>
      ) : null}
      <details className="financegovernance" open={model.governance.some((item) => item.key === model.active)}>
        <summary>账本与治理</summary>
        <div role="navigation" aria-label="财务二级治理工具">
          {model.governance.map((item) => (
            <button key={item.key} type="button" aria-current={item.key === model.active ? 'page' : undefined} onClick={() => model.select(item.route)}>
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
