import { useMemo } from 'react';
import { chineseReference } from '@shop/presentation';
import type { DataColumn } from '../../shared/ui/DataTable';
import { DataTable } from '../../shared/ui/DataTable';
import { formatDate, formatMinor } from '../../shared/ui/Format';
import { voucherStateLabel, voucherStateTone, voucherViewMeta } from './VoucherPresentation';
import type { VoucherRecord, VoucherView } from './VoucherSchema';

export interface VoucherTableProps {
  readonly rows: readonly VoucherRecord[];
  readonly view: VoucherView;
  readonly onOpen: (record: VoucherRecord) => void;
}

export function VoucherTable({ rows, view, onOpen }: VoucherTableProps) {
  const columns = useMemo(() => columnsFor(view, onOpen), [onOpen, view]);
  return <DataTable caption={voucherViewMeta[view].label} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

function columnsFor(view: VoucherView, onOpen: (record: VoucherRecord) => void): readonly DataColumn<VoucherRecord>[] {
  const identity: DataColumn<VoucherRecord> = {
    key: 'name',
    label: view === 'libraries' ? '卡号库 / 前缀' : view === 'reserves' ? '申请名称' : view === 'batches' ? '发行批次' : '卡券方案',
    render: (row) => (
      <div className="voucheridentity">
        <span className={`vouchermark is-${view}`} aria-hidden="true">
          {voucherViewMeta[view].short}
        </span>
        <span>
          <button type="button" onClick={() => onOpen(row)} aria-label={`查看${row.name}摘要`}>
            {row.name}
          </button>
          <code>{chineseReference(voucherViewMeta[view].short, row.id)}</code>
        </span>
      </div>
    ),
  };
  const state: DataColumn<VoucherRecord> = {
    key: 'state',
    label: '状态',
    render: (row) => (
      <span className={`voucherstate is-${voucherStateTone(row.state)}`}>
        <i aria-hidden="true" />
        {voucherStateLabel(row.state)}
      </span>
    ),
  };
  const action: DataColumn<VoucherRecord> = {
    key: 'action',
    label: '操作',
    render: (row) => (
      <button className="voucherrowaction" type="button" onClick={() => onOpen(row)}>
        查看
      </button>
    ),
  };

  if (view === 'programs')
    return Object.freeze([
      identity,
      { key: 'amount', label: '面值', render: (row) => formatRecordAmount(row) },
      { key: 'detail', label: '审批机制', render: (row) => row.detail },
      state,
      { key: 'version', label: '版本', render: (row) => (row.version === null ? '—' : `第 ${row.version} 版`) },
      action,
    ]);
  if (view === 'libraries')
    return Object.freeze([
      identity,
      { key: 'detail', label: '生成 / 导入方式', render: (row) => row.detail },
      { key: 'quantity', label: '成功数量', render: (row) => formatQuantity(row.quantity) },
      state,
      { key: 'version', label: '版本', render: (row) => (row.version === null ? '—' : `第 ${row.version} 版`) },
      action,
    ]);
  if (view === 'reserves')
    return Object.freeze([
      identity,
      { key: 'detail', label: '申请单号', render: (row) => <code className="vouchercode">{row.detail}</code> },
      { key: 'quantity', label: '申请数量', render: (row) => formatQuantity(row.quantity) },
      { key: 'amount', label: '申请金额（最小单位）', render: (row) => formatRecordAmount(row) },
      state,
      { key: 'time', label: '创建时间', render: (row) => formatDate(row.occurredAt) },
      action,
    ]);
  return Object.freeze([
    identity,
    { key: 'detail', label: '发行进度', render: (row) => row.detail },
    { key: 'quantity', label: '已发行', render: (row) => formatQuantity(row.quantity) },
    state,
    { key: 'time', label: '创建时间', render: (row) => formatDate(row.occurredAt) },
    action,
  ]);
}

export function formatRecordAmount(row: VoucherRecord): string {
  if (row.amountMinor === null) return '—';
  return row.currency === null ? `${formatQuantity(row.amountMinor)} 分` : formatMinor(row.amountMinor, row.currency);
}

function formatQuantity(value: number | null): string {
  return value === null ? '—' : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
}
