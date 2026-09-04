import { Button, DataTable, type DataColumn } from '@shop/design';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { SettingsViewModel } from '../viewmodel/SettingsViewModel';
import { ReferralState } from './ReferralState';

type Row = SettingsViewModel['rows'][number];
const columns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'state', label: '运行状态', render: (row) => <ReferralState value={row.enabled ? 'active' : 'inactive'} /> },
  { key: 'touch', label: '首次归因窗口', render: (row) => `${row.firstTouchDays} 天` },
  { key: 'rate', label: '默认返佣', render: (row) => `${(row.rateBasisPoints / 100).toFixed(2)}%` },
  { key: 'minimum', label: '最低提现', render: (row) => formatMinor(row.minimumWithdrawalMinor, row.currency) },
  { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function SettingsPanel({ model }: Readonly<{ model: SettingsViewModel }>) {
  const row = model.rows[0];
  return (
    <section className="referralpanel">
      <header>
        <div>
          <p>全商城策略</p>
          <h2>返佣策略</h2>
        </div>
        {model.canManage && row ? (
          <Button tone="primary" onPress={() => model.manage(row)}>
            编辑设定
          </Button>
        ) : null}
      </header>
      <DataTable caption="分销设定" columns={columns} rows={model.rows} rowKey={(item) => item.id} />
    </section>
  );
}
