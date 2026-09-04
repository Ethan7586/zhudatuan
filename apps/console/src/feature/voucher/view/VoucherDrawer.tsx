import { Button, Drawer } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { VoucherOperation, VoucherProgress, VoucherRecord, VoucherTimeline, VoucherView } from '../model/Voucher';
import { isDangerousVoucherOperation } from '../model/VoucherAction';
import { voucherOperationMeta } from '../model/VoucherOperationCatalog';
import { voucherStateLabel, voucherStateTone, voucherViewMeta } from './VoucherPresentation';

export function VoucherDrawer({ record, view, operations, pending, timeline, timelinePending, timelineError, progress, onAction, onClose }: Readonly<{ record?: VoucherRecord; view: VoucherView; operations: readonly VoucherOperation[]; pending: boolean; timeline?: VoucherTimeline; timelinePending: boolean; timelineError?: string; progress?: VoucherProgress; onAction: (operation: VoucherOperation, record: VoucherRecord) => void; onClose: () => void }>) {
  return <Drawer open={record !== undefined} title={record?.name ?? `${voucherViewMeta[view].label}摘要`} onClose={onClose}>{record ? <div className="voucherdrawerbody">
    <code>{chineseReference(voucherViewMeta[view].short, record.id)}</code>
    <section className="voucherdrawerstatus"><span className={`voucherstate is-${voucherStateTone(record.state)}`}><i aria-hidden="true" />{voucherStateLabel(record.state)}</span><p>{pending ? '正在读取最新详情…' : '以下字段来自当前管理范围的权威服务端模型；敏感凭证只显示掩码。'}</p></section>
    <dl className="voucherfacts"><Fact label="业务详情" value={record.detail} /><Fact label="数量" value={record.quantity === null ? '—' : new Intl.NumberFormat('zh-CN').format(record.quantity)} /><Fact label="金额" value={record.amountMinor === null ? '—' : formatMinor(record.amountMinor, record.currency ?? 'CNY')} /><Fact label="服务端时间" value={formatDate(record.occurredAt)} /><Fact label="版本" value={record.version === null ? '—' : `第 ${record.version} 版`} />{Object.entries(record.raw).filter(([key]) => !['id', 'state', 'version'].includes(key)).slice(0, 8).map(([key, value]) => <Fact key={key} label={fieldLabel(key)} value={display(value)} />)}</dl>
    {progress ? <section className="voucherdrawerprogress"><strong>发放批次进度</strong><progress max={progress.total || 1} value={progress.processed}>{progress.processed} / {progress.total}</progress><p>已处理 {progress.processed} / {progress.total}，成功 {progress.succeeded}，失败 {progress.failed}，可重试 {progress.retryable}。</p></section> : null}
    {timelinePending ? <p className="vouchertimelinepending" role="status">正在读取完整生命周期…</p> : null}
    {timelineError ? <p className="vouchertimelinepending" role="alert">{timelineError}</p> : null}
    {timeline?.items.length ? <section className="vouchertimeline"><h3>生命周期时间线</h3><ol>{timeline.items.map((item) => <li key={item.sequence}><i aria-hidden="true" /><div><strong>{item.previous ? `${voucherStateLabel(item.previous)} → ` : ''}{voucherStateLabel(item.next)}</strong><span>{item.reason}</span><small>{formatDate(item.occurredAt)} · 操作人 {chineseReference('成员', item.actor)}</small>{item.redemption ? <small>关联核销 {chineseReference('回执', reference(item.redemption.id))}</small> : null}</div></li>)}</ol></section> : null}
    {operations.length ? <footer>{operations.map((operation) => <Button key={operation} tone={isDangerousVoucherOperation(operation) ? 'danger' : 'default'} onPress={() => onAction(operation, record)}>{voucherOperationMeta(operation).label}</Button>)}</footer> : null}
  </div> : null}</Drawer>;
}
function Fact({ label, value }: Readonly<{ label: string; value: string }>) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function reference(value: unknown): string { return typeof value === 'string' || typeof value === 'number' ? String(value) : '—'; }
function display(value: unknown): string { if (value === null || value === undefined || value === '') return '—'; if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value); if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${fieldLabel(key)}：${display(item)}`).join('；'); return '—'; }
function fieldLabel(key: string): string { return ({ number: '业务编号', numberMasked: '卡号掩码', customer: '卡券客户', product: '卡券产品', pool: '卡号库', holder: '持有人', faceMinor: '面值（分）', remainingMinor: '剩余金额（分）', initialMinor: '初始金额（分）', currency: '币种', validity: '有效期', activation: '激活方式', approvalRequired: '需要审批', requestedBy: '申请人', approval: '审批实例', issueBatch: '发放批次', fingerprint: '安全指纹', keyVersion: '密钥版本' } as Readonly<Record<string, string>>)[key] ?? key; }
