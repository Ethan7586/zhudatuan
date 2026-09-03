import { Button } from '@shop/design';
import { DataTable, type DataColumn } from '@shop/design';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import type { ReferralAction, ReferralSetting } from './ReferralSchema';

const columns: readonly DataColumn<ReferralSetting>[] = Object.freeze([
  { key: 'state', label: '运行状态', render: (row) => <State value={row.enabled ? 'active' : 'inactive'} /> },
  { key: 'touch', label: '首次归因窗口', render: (row) => `${row.firstTouchDays} 天` },
  { key: 'rate', label: '默认返佣', render: (row) => `${(row.rateBasisPoints / 100).toFixed(2)}%` },
  { key: 'minimum', label: '最低提现', render: (row) => formatMinor(row.minimumWithdrawalMinor, row.currency) },
  { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);

export function SettingsPanel({ rows, canManage, onManage }: Readonly<{ rows: readonly ReferralSetting[]; canManage: boolean; onManage: (action: ReferralAction) => void }>) {
  const row = rows[0];
  return (
    <section className="referralpanel">
      <header>
        <h2>返佣策略</h2>
        <Button onPress={() => row && onManage({ kind: 'setting', id: row.id, version: row.version, label: '编辑分销设定', setting: row })} isDisabled={!canManage || row === undefined}>
          编辑设定
        </Button>
      </header>
      <DataTable caption="分销设定" columns={columns} rows={rows} rowKey={(item) => item.id} />
    </section>
  );
}

export function State({ value }: Readonly<{ value: string }>) {
  return (
    <span className="referralstate" data-state={value}>
      {stateLabel(value)}
    </span>
  );
}

function stateLabel(value: string): string {
  return (
    (
      {
        active: '生效',
        inactive: '停用',
        applied: '待审核',
        disqualified: '已取消资格',
        pending: '待结算',
        available: '可结算',
        settled: '已结算',
        reversed: '已冲正',
        requested: '已申请',
        processing: '处理中',
        paid: '已付款',
        failed: '失败',
      } as Readonly<Record<string, string>>
    )[value] ?? '待识别状态'
  );
}
