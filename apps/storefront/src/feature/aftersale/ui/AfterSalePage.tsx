import { ArrowLeft, Clock3, RefreshCw, ShieldAlert, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApplyAfterSale } from '../application/ApplyAfterSale';
import { readAfterSale } from '../application/ReadAfterSale';
import type { AfterSaleAttachmentInput, AfterSalePage as AfterSalePageModel, AfterSaleState } from '../model/AfterSale';
import { useSession } from '../../../shared/runtime/SessionContext';
import { textValue } from '../../../shared/format/Text';

interface AfterSalePageProps {
  readonly orderId: string;
  readonly onBack: () => void;
}

const reasons = Object.freeze([
  ['quality', '商品质量问题'],
  ['damaged', '运输破损'],
  ['wrongitem', '错发或漏发'],
  ['notneeded', '不再需要'],
  ['service', '服务未按约完成'],
] as const);

export function AfterSalePage({ orderId, onBack }: AfterSalePageProps) {
  const session = useSession();
  const command = useRef(new ApplyAfterSale());
  const [page, setPage] = useState<AfterSalePageModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string>(reasons[0][0]);
  const [description, setDescription] = useState('');
  const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({});
  const [attachments, setAttachments] = useState<readonly AfterSaleAttachmentInput[]>([]);
  const load = useCallback(async () => {
    setError(null);
    try {
      if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
      setPage(await readAfterSale(session.session, orderId));
    } catch (cause) {
      setError(message(cause, '售后信息加载失败，请稍后重试'));
    }
  }, [orderId, session.session]);
  useEffect(() => void load(), [load]);
  const selected = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([lineId, quantity]) => ({ lineId, quantity })),
    [quantities]
  );
  const expected = useMemo(
    () =>
      page?.availableLines.reduce((total, line) => {
        const quantity = quantities[line.lineId] ?? 0;
        return total + (line.maximumQuantity === 0 ? 0 : Math.floor((line.expectedRefundMinor * quantity) / line.maximumQuantity));
      }, 0) ?? 0,
    [page, quantities]
  );

  async function submit() {
    if (selected.length === 0 || description.trim().length < 5) return setError('请选择可售后商品并填写至少 5 个字的问题说明');
    setBusy(true);
    setError(null);
    try {
      if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
      await command.current.execute(session.session, orderId, { lines: selected, reason, description: description.trim(), attachments });
      setDescription('');
      setQuantities({});
      setAttachments([]);
      await load();
    } catch (cause) {
      setError(message(cause, '售后申请提交失败，请核对可售后数量后重试'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sw-web-container mx-auto max-w-[1240px] px-3 py-4 text-xs">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 font-bold text-[var(--sw-brand)]">
        <ArrowLeft size={15} />
        返回订单
      </button>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <h1 className="text-lg font-black text-gray-900">申请售后</h1>
            <p className="mt-1 text-gray-500">订单 {orderId} · 数量、时间窗与退款金额由服务端实时判定</p>
          </div>
          {page === null && error === null ? <State icon={RefreshCw} text="正在读取可售后商品…" /> : null}
          {error ? (
            <div role="alert" className="rounded-lg bg-red-50 p-3 font-bold text-red-700">
              {error}
            </div>
          ) : null}
          {page?.availableLines.map((line) => (
            <article key={line.lineId} className={`rounded-lg border p-3 ${line.available ? 'border-gray-200' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <b className="text-sm text-gray-900">{line.title}</b>
                  <p className="mt-1">
                    已履约 {line.fulfilledQuantity} · 已售后 {line.claimedQuantity} · 最多 {line.maximumQuantity}
                  </p>
                </div>
                <b>预计 ¥{(line.expectedRefundMinor / 100).toFixed(2)}</b>
              </div>
              {line.available ? (
                <label className="mt-3 flex items-center gap-2">
                  申请数量
                  <input
                    aria-label={`${line.title}申请数量`}
                    type="number"
                    min={0}
                    max={line.maximumQuantity}
                    value={quantities[line.lineId] ?? 0}
                    onChange={(event) => setQuantities((current) => ({ ...current, [line.lineId]: Math.min(line.maximumQuantity, Math.max(0, Number(event.target.value) || 0)) }))}
                    className="w-20 rounded border px-2 py-1"
                  />
                  {line.requiresReturn ? '需退回商品并通过验收' : '无需退回商品'}
                </label>
              ) : (
                <p className="mt-2 font-bold text-amber-700">不可申请：{unavailable(line.unavailableReason)}</p>
              )}
            </article>
          ))}
          {page && page.availableLines.length === 0 ? <State icon={ShieldAlert} text="此订单当前没有可申请售后的商品" /> : null}
          <label className="block font-bold">
            售后原因
            <select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal">
              {reasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-bold">
            问题说明
            <textarea value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border p-2 font-normal" placeholder="请描述问题、发生时间和期望处理方式" />
          </label>
          <AttachmentFiles value={attachments} onChange={setAttachments} onError={setError} />
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="flex items-center justify-between">
              <span>预计原路退回</span>
              <b className="text-lg text-[var(--sw-brand)]">¥{(expected / 100).toFixed(2)}</b>
            </div>
            <p className="mt-1 text-gray-500">最终按原支付媒介可退余额确定，拆分明细会写入退款时间线。</p>
          </div>
          <button type="button" disabled={busy || selected.length === 0} onClick={() => void submit()} className="w-full rounded-lg bg-[var(--sw-brand)] py-2.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? '正在安全提交…' : '提交售后申请'}
          </button>
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-black">处理进度</h2>
          {page?.items.map((sale) => (
            <article key={sale.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between">
                <b>{label(sale.state)}</b>
                <span>¥{(sale.expectedRefundMinor / 100).toFixed(2)}</span>
              </div>
              <p className="mt-2 text-gray-500">{sale.description}</p>
              <div className="mt-3 rounded-lg bg-gray-50 p-2">
                <b>预计退款拆分</b>
                {sale.expectedRefund.tenders.map((tender, index) => (
                  <div key={`${tender.kind}:${tender.reference ?? index}`} className="mt-1 flex justify-between">
                    <span>{tenderLabel(tender.kind)}</span>
                    <span>¥{(tender.amountMinor / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {sale.returns.map((returned) => (
                <div key={returned.id} className="mt-3 rounded-lg border border-blue-100 p-2">
                  <b>退货指引 · {returned.provider ?? '平台自营'}</b>
                  <p className="mt-1 text-gray-500">
                    {returned.providerReference ? `外部退货单 ${returned.providerReference}` : '平台退货单'}
                    {returned.trackingNumber ? ` · 运单 ${returned.trackingNumber}` : ''}
                  </p>
                  <p className="text-gray-500">{textValue(returned.instruction.address ?? returned.instruction.message)}</p>
                </div>
              ))}
              <ol className="mt-4 space-y-3 border-l-2 border-blue-100 pl-4">
                {sale.timeline.map((item) => (
                  <li key={item.sequence}>
                    <b>{label(item.state)}</b>
                    <p className="text-gray-500">{evidenceText(item.evidence)}</p>
                    <p className="text-gray-400">{new Date(item.occurredAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
                  </li>
                ))}
              </ol>
            </article>
          ))}
          {page && page.items.length === 0 ? <State icon={Clock3} text="尚未提交售后申请" /> : null}
        </div>
      </div>
    </section>
  );
}

function AttachmentFiles({ value, onChange, onError }: { readonly value: readonly AfterSaleAttachmentInput[]; readonly onChange: (value: readonly AfterSaleAttachmentInput[]) => void; readonly onError: (value: string | null) => void }) {
  async function select(files: FileList | null) {
    if (!files) return;
    const selected = [...files];
    if (
      value.length + selected.length > 6 ||
      selected.some(({ size }) => size < 1 || size > 1_000_000) ||
      value.reduce((total, item) => total + Math.floor(item.data.length * 0.75), 0) + selected.reduce((total, file) => total + file.size, 0) > 1_250_000
    ) {
      onError('最多上传 6 个 JPG、PNG 或 PDF，单个不超过 1 MB、合计不超过 1.25 MB');
      return;
    }
    const accepted = selected.filter((file): file is File & { type: AfterSaleAttachmentInput['contentType'] } => ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type));
    if (accepted.length !== selected.length) {
      onError('附件仅支持 JPG、PNG 和 PDF');
      return;
    }
    onError(null);
    onChange([...value, ...(await Promise.all(accepted.map(async (file) => ({ name: file.name, contentType: file.type, data: await base64(file) }))))]);
  }
  return (
    <div>
      <b>图片/附件</b>
      <p className="mt-1 text-gray-400">文件会上传至私有对象存储，并由服务端复核 MIME、文件头、大小、SHA-256 与恶意文件扫描结果。</p>
      <label className="mt-2 inline-flex cursor-pointer rounded-lg border px-3 py-2 font-bold focus-within:ring-2 focus-within:ring-[var(--sw-brand)]">
        选择文件
        <input
          aria-label="选择售后附件"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          multiple
          className="sr-only"
          onChange={(event) => {
            void select(event.target.files);
            event.target.value = '';
          }}
        />
      </label>
      {value.map((item, index) => (
        <div key={`${item.name}:${index}`} className="mt-1 flex justify-between rounded bg-gray-50 p-2">
          <span>{item.name}</span>
          <button type="button" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>
            移除
          </button>
        </div>
      ))}
    </div>
  );
}

function base64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ATTACHMENT_READ_FAILED'));
    reader.onload = () => resolve(typeof reader.result === 'string' ? (reader.result.split(',', 2)[1] ?? '') : '');
    reader.readAsDataURL(file);
  });
}

function State({ icon: Icon, text }: { readonly icon: LucideIcon; readonly text: string }) {
  return (
    <div role="status" className="grid min-h-28 place-items-center rounded-lg bg-gray-50 text-gray-500">
      <Icon size={22} />
      <span>{text}</span>
    </div>
  );
}
function label(state: AfterSaleState): string {
  return ({ applied: '已申请', reviewing: '审核中', approved: '已批准', returning: '退货中', received: '已收货', refunding: '退款中', resolved: '已完成', rejected: '未通过' } as const)[state];
}
function unavailable(reason: string | null): string {
  return (
    ({ NOT_FULFILLED: '商品尚未履约', PROVIDER_NOT_RETURNABLE: '供应商规则不支持', QUANTITY_EXHAUSTED: '可售后数量已用完', QUANTITY_EXCEEDED: '数量超过上限', AFTERSALE_WINDOW_EXPIRED: '已超过售后期限' } as Record<string, string>)[
      reason ?? ''
    ] ?? '当前条件不满足'
  );
}
function tenderLabel(kind: string): string {
  return ({ wechat: '微信支付', benefit: '福利账户', voucher: '卡券' } as Record<string, string>)[kind] ?? kind;
}
function evidenceText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const evidence = value as Record<string, unknown>;
  const returns = Array.isArray(evidence.returns) ? (evidence.returns as Array<Record<string, unknown>>) : [];
  if (returns.length === 0) return '';
  return returns
    .map((returned) =>
      [
        returned.provider ? `供应商 ${textValue(returned.provider)}` : '平台退货',
        returned.trackingNumber ? `运单 ${textValue(returned.trackingNumber)}` : '',
        returned.instruction && typeof returned.instruction === 'object' ? textValue((returned.instruction as Record<string, unknown>).address) : '',
      ]
        .filter(Boolean)
        .join(' · ')
    )
    .join('；');
}
function message(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
