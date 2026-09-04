import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { Partner } from '../model/Partner';
import type { PartnerViewModel } from '../viewmodel/PartnerViewModel';

export function PartnerTable({ rows, model }: Readonly<{ rows: readonly Partner[]; model: PartnerViewModel }>) {
  const columns: readonly DataColumn<Partner>[] = [
    {
      key: 'name',
      label: model.section === 'brand' ? '品牌' : '供应商',
      render: (row) => (
        <button className="partnerlink" type="button" onClick={() => model.actions.select({ kind: 'partner', value: row })}>
          {row.name}
        </button>
      ),
    },
    { key: 'scope', label: '所属范围', render: (row) => chineseReference('组织范围', row.scopeId) },
    { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
    { key: 'qualification', label: '有效资质', render: (row) => `${row.qualification.valid} 项` },
    { key: 'expiry', label: '最近到期', render: (row) => formatDate(row.qualification.nearestExpiry) },
    { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
    {
      key: 'action',
      label: '操作',
      render: (row) => (
        <div className="partneractions">
          <Button onPress={() => model.actions.select({ kind: 'partner', value: row })}>查看</Button>
          {model.canManage ? (
            <Button tone="primary" onPress={() => model.actions.edit({ kind: 'partner', value: row })}>
              编辑
            </Button>
          ) : null}
        </div>
      ),
    },
  ];
  return <DataTable caption={model.section === 'brand' ? '品牌列表' : '供应商列表'} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
