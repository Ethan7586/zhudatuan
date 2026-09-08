import { Button, Drawer } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { FinanceFact } from '../model/Finance';
import type { SectionViewModel } from '../viewmodel/SectionViewModel';

export function FinanceRecordDrawer({ model }: Readonly<{ model: SectionViewModel }>) {
  const record = model.selected;
  return (
    <Drawer open={record !== undefined} title="财务记录详情" onClose={model.actions.close}>
      {record === undefined ? null : (
        <div className="financerecorddetail">
          <header>
            <span className="financestate" data-tone="info">
              {chineseDomainLabel(record.state)}
            </span>
            <h3>{record.label}</h3>
            <p>
              {chineseReference('业务', record.reference)} · {record.version === null ? '不可变事实' : `第 ${record.version} 版`}
            </p>
          </header>
          <section aria-labelledby="financebusinessfacts">
            <h4 id="financebusinessfacts">业务事实</h4>
            <dl className="financedetailgrid">
              {record.facts.map((fact) => (
                <Fact key={fact.label} fact={fact} />
              ))}
            </dl>
          </section>
          {record.technicalFacts.length === 0 ? null : (
            <details className="financetechnicalfacts">
              <summary>查看技术核验信息</summary>
              <dl className="financedetailgrid">
                {record.technicalFacts.map((fact) => (
                  <Fact key={fact.label} fact={fact} />
                ))}
              </dl>
            </details>
          )}
          <footer className="financerecordactions">
            {model.canAudit ? <Button onPress={() => model.actions.audit(record)}>查看业务证据链</Button> : null}
            {model.recordActions.map((action) => (
              <Button key={action.kind} tone="primary" onPress={() => model.actions.begin(action)}>
                {action.label}
              </Button>
            ))}
          </footer>
        </div>
      )}
    </Drawer>
  );
}

function Fact({ fact }: Readonly<{ fact: FinanceFact }>) {
  const value =
    fact.kind === 'money'
      ? formatMinor(fact.minor, fact.currency)
      : fact.kind === 'time'
        ? formatDate(fact.value)
        : fact.kind === 'reference'
          ? fact.value
            ? chineseReference(fact.label, fact.value)
            : '—'
          : fact.value
            ? chineseDomainLabel(fact.value, fact.value)
            : '—';
  return (
    <div>
      <dt>{fact.label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
