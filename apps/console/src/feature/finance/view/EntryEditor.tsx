import { Button } from '@shop/design';
import type { FinanceEntryDraft } from '../model/FinanceGovernance';

export function EntryEditor({ entries, disabled, onChange, onAdd, onRemove }: Readonly<{
  entries: readonly FinanceEntryDraft[];
  disabled: boolean;
  onChange: (index: number, key: keyof FinanceEntryDraft, value: string | number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}>) {
  const debit = entries.reduce((total, entry) => total + entry.debitMinor, 0);
  const credit = entries.reduce((total, entry) => total + entry.creditMinor, 0);
  return (
    <section className="governanceentries" aria-label="复式记账分录">
      <header><div><strong>复式记账分录</strong><span>每行只填借方或贷方，金额单位为分</span></div><Button onPress={onAdd} isDisabled={disabled || entries.length >= 100}>增加分录</Button></header>
      <div className="governanceentryhead" aria-hidden="true"><span>科目</span><span>借方（分）</span><span>贷方（分）</span><span>说明</span><span>操作</span></div>
      {entries.map((entry, index) => (
        <fieldset className="governanceentry" key={index} disabled={disabled}>
          <legend>分录 {index + 1}</legend>
          <label><span>科目</span><input value={entry.account} maxLength={200} onChange={(event) => onChange(index, 'account', event.target.value)} placeholder="例如 expense.goods" required /></label>
          <label><span>借方（分）</span><input type="number" min={0} step={1} value={entry.debitMinor} onChange={(event) => onChange(index, 'debitMinor', Number(event.target.value))} required /></label>
          <label><span>贷方（分）</span><input type="number" min={0} step={1} value={entry.creditMinor} onChange={(event) => onChange(index, 'creditMinor', Number(event.target.value))} required /></label>
          <label><span>说明</span><input value={entry.memo} maxLength={500} onChange={(event) => onChange(index, 'memo', event.target.value)} placeholder="说明这笔分录的业务含义" required /></label>
          <Button tone="danger" onPress={() => onRemove(index)} isDisabled={disabled || entries.length <= 2}>移除</Button>
        </fieldset>
      ))}
      <footer data-balanced={debit > 0 && debit === credit}><span>借方合计 <strong>{debit.toLocaleString('zh-CN')} 分</strong></span><span>贷方合计 <strong>{credit.toLocaleString('zh-CN')} 分</strong></span><b>{debit > 0 && debit === credit ? '借贷平衡' : '借贷不平衡'}</b></footer>
    </section>
  );
}
