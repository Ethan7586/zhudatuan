import { DataTable, type DataColumn } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { useMemo } from 'react';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { VoucherRecord, VoucherView } from '../model/Voucher';
import { voucherStateLabel, voucherStateTone, voucherViewMeta } from './VoucherPresentation';

export function VoucherTable({ rows, view, onOpen }: Readonly<{ rows: readonly VoucherRecord[]; view: VoucherView; onOpen: (record: VoucherRecord) => void }>) {
  const columns = useMemo(() => columnsFor(view, onOpen), [onOpen, view]);
  return <DataTable caption={voucherViewMeta[view].label} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
function columnsFor(view: VoucherView, onOpen: (record: VoucherRecord) => void): readonly DataColumn<VoucherRecord>[] {
  const identity: DataColumn<VoucherRecord> = { key: 'name', label: voucherViewMeta[view].label, render: (row) => <div className="voucheridentity"><span className={`vouchermark is-${view}`} aria-hidden="true">{voucherViewMeta[view].short}</span><span><button type="button" onClick={() => onOpen(row)} aria-label={`查看${row.name}摘要`}>{row.name}</button><code>{chineseReference(voucherViewMeta[view].short, row.id)}</code></span></div> };
  const state: DataColumn<VoucherRecord> = { key: 'state', label: '状态', render: (row) => <span className={`voucherstate is-${voucherStateTone(row.state)}`}><i aria-hidden="true" />{voucherStateLabel(row.state)}</span> };
  const detail: DataColumn<VoucherRecord> = { key: 'detail', label: '业务摘要', render: (row) => row.detail };
  const amount: DataColumn<VoucherRecord> = { key: 'amount', label: '金额 / 余额', render: (row) => row.amountMinor === null ? '—' : formatMinor(row.amountMinor, row.currency ?? 'CNY') };
  const quantity: DataColumn<VoucherRecord> = { key: 'quantity', label: '数量', render: (row) => row.quantity === null ? '—' : new Intl.NumberFormat('zh-CN').format(row.quantity) };
  const time: DataColumn<VoucherRecord> = { key: 'time', label: '更新时间', render: (row) => formatDate(row.occurredAt) };
  const action: DataColumn<VoucherRecord> = { key: 'action', label: '操作', render: (row) => <button className="voucherrowaction" type="button" onClick={() => onOpen(row)}>查看与操作</button> };
  if (view === 'products' || view === 'vouchers' || view === 'search' || view === 'redemptions') return Object.freeze([identity, detail, amount, state, time, action]);
  if (view === 'pools' || view === 'stocks' || view === 'issues' || view === 'actions') return Object.freeze([identity, detail, quantity, state, time, action]);
  return Object.freeze([identity, detail, state, time, action]);
}
