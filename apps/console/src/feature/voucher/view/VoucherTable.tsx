import { DataTable, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { useMemo } from 'react';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { VoucherRecord, VoucherView } from '../model/Voucher';
import { voucherStateLabel, voucherStateTone, voucherViewMeta } from './VoucherPresentation';

export interface VoucherTableProps {
  readonly rows: readonly VoucherRecord[];
  readonly view: VoucherView;
  readonly selected: ReadonlySet<string>;
  readonly onOpen: (record: VoucherRecord) => void;
  readonly onSelect: (id: string) => void;
}

export function VoucherTable({ rows, view, selected, onOpen, onSelect }: VoucherTableProps) {
  const columns = useMemo(() => columnsFor(view, selected, onOpen, onSelect), [onOpen, onSelect, selected, view]);
  return <DataTable caption={voucherViewMeta[view].label} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

function columnsFor(view: VoucherView, selected: ReadonlySet<string>, onOpen: (record: VoucherRecord) => void, onSelect: (id: string) => void): readonly DataColumn<VoucherRecord>[] {
  const identity: DataColumn<VoucherRecord> = { key: 'name', label: identityLabel(view), render: (row) => <div className="voucheridentity"><span className={`vouchermark is-${view}`} aria-hidden="true">{voucherViewMeta[view].short}</span><span><button type="button" onClick={() => onOpen(row)} aria-label={`查看${row.name}摘要`}>{row.name}</button><code>{chineseReference(voucherViewMeta[view].short, row.id)}</code></span></div> };
  const state: DataColumn<VoucherRecord> = { key: 'state', label: '状态', render: (row) => <span className={`voucherstate is-${voucherStateTone(row.state)}`}><i aria-hidden="true" />{voucherStateLabel(row.state)}</span> };
  const action: DataColumn<VoucherRecord> = { key: 'action', label: '操作', render: (row) => <button className="voucherrowaction" type="button" onClick={() => onOpen(row)}>查看</button> };
  const selection: DataColumn<VoucherRecord> = { key: 'selection', label: '选择', render: (row) => <input type="checkbox" aria-label={`选择${row.name}`} checked={selected.has(row.id)} onChange={() => onSelect(row.id)} /> };
  if (view === 'programs') return Object.freeze([identity, amountColumn('面值'), { key: 'detail', label: '审批机制', render: (row) => row.detail }, state, versionColumn(), action]);
  if (view === 'libraries') return Object.freeze([identity, { key: 'detail', label: '生成 / 导入方式', render: (row) => row.detail }, quantityColumn('成功数量'), state, versionColumn(), action]);
  if (view === 'reserves') return Object.freeze([identity, { key: 'detail', label: '申请单号', render: (row) => <code className="vouchercode">{row.detail}</code> }, quantityColumn('申请数量'), amountColumn('申请金额（最小单位）'), state, timeColumn(), action]);
  if (view === 'batches') return Object.freeze([identity, { key: 'detail', label: '发行进度', render: (row) => row.detail }, quantityColumn('已发行'), state, timeColumn(), action]);
  if (view === 'bindings') return Object.freeze([selection, identity, { key: 'detail', label: '绑定记录', render: (row) => row.detail }, amountColumn('剩余金额'), state, timeColumn('有效期'), versionColumn(), action]);
  if (view === 'redemptions') return Object.freeze([identity, { key: 'detail', label: '消费来源', render: (row) => row.detail }, amountColumn('净消费金额'), state, timeColumn('消费时间'), action]);
  return Object.freeze([identity, { key: 'detail', label: '执行详情', render: (row) => row.detail }, quantityColumn(view === 'history' ? '事件序号' : '处理数量'), state, timeColumn(), action]);
}

function identityLabel(view: VoucherView): string { return ({ programs: '卡券方案', libraries: '卡号库 / 前缀', reserves: '申请名称', batches: '发行批次', statusbatches: '批量任务', bindings: '卡券方案', redemptions: '消费回执', history: '状态记录' } as const)[view]; }
function amountColumn(label: string): DataColumn<VoucherRecord> { return { key: 'amount', label, render: formatRecordAmount }; }
function quantityColumn(label: string): DataColumn<VoucherRecord> { return { key: 'quantity', label, render: (row) => formatQuantity(row.quantity) }; }
function timeColumn(label = '创建时间'): DataColumn<VoucherRecord> { return { key: 'time', label, render: (row) => formatDate(row.occurredAt) }; }
function versionColumn(): DataColumn<VoucherRecord> { return { key: 'version', label: '版本', render: (row) => row.version === null ? '—' : `第 ${row.version} 版` }; }
export function formatRecordAmount(row: VoucherRecord): string { if (row.amountMinor === null) return '—'; return row.currency === null ? `${formatQuantity(row.amountMinor)} 分` : formatMinor(row.amountMinor, row.currency); }
function formatQuantity(value: number | null): string { return value === null ? '—' : new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value); }
