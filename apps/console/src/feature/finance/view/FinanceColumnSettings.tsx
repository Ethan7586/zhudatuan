import { Button } from '@shop/design';
import type { FinanceColumnKey } from '../model/Finance';

const columns: readonly Readonly<{ key: FinanceColumnKey; label: string }>[] = Object.freeze([
  { key: 'channel', label: '渠道 / 数据源' },
  { key: 'scope', label: '所属范围' },
  { key: 'matched', label: '已匹配' },
  { key: 'differences', label: '差异' },
  { key: 'channelAmount', label: '渠道金额' },
  { key: 'ledgerAmount', label: '账本金额' },
  { key: 'differenceAmount', label: '差额' },
  { key: 'state', label: '状态' },
  { key: 'time', label: '完成 / 更新时间' },
]);

export function FinanceColumnSettings({
  open,
  visible,
  onToggle,
  onClose,
}: Readonly<{
  open: boolean;
  visible: ReadonlySet<FinanceColumnKey>;
  onToggle: (key: FinanceColumnKey) => void;
  onClose: () => void;
}>) {
  if (!open) return null;
  return (
    <section id="financecolumnsettings" className="financecolumnsettings" aria-label="对账列表列设置">
      <header>
        <strong>列设置</strong>
        <Button tone="quiet" onPress={onClose}>
          完成
        </Button>
      </header>
      <p>选择当前设备要显示的列；批次、勾选与操作列固定显示。</p>
      <div>
        {columns.map((column) => (
          <label key={column.key}>
            <input type="checkbox" checked={visible.has(column.key)} onChange={() => onToggle(column.key)} />
            {column.label}
          </label>
        ))}
      </div>
    </section>
  );
}
