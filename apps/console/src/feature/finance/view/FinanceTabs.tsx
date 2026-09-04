import type { FinanceNavigationViewModel } from '../viewmodel/NavigationViewModel';

export function FinanceTabs({ model }: Readonly<{ model: FinanceNavigationViewModel }>) {
  return (
    <nav className="financetabs" aria-label="财务工作台">
      {model.items.map((tab) => (
        <button key={tab.key} type="button" aria-current={model.active === tab.key ? 'page' : undefined} onClick={() => model.select(tab.route)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
