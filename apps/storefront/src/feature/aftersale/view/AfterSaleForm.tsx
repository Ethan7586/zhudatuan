import { formatMinor } from '../../../shared/format/Money';
import type { useAfterSaleViewModel } from '../viewmodel/AfterSaleViewModel';
import { afterSaleReasons } from '../viewmodel/AfterSaleViewModel';

export function AfterSaleForm({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useAfterSaleViewModel> }>) {
  const { page, reason, description, quantities, attachments, selected, expectedMinor, busy, actions } = viewmodel;
  return <>
    {page?.availableLines.map((line) => <article key={line.lineId} className={`rounded-lg border p-3 ${line.available ? 'border-gray-200' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>
      <div className="flex items-start justify-between gap-4"><div><b className="text-sm text-gray-900">{line.title}</b><p className="mt-1">已履约 {line.fulfilledQuantity} · 已售后 {line.claimedQuantity} · 最多 {line.maximumQuantity}</p></div><b>预计 ¥{formatMinor(line.expectedRefundMinor)}</b></div>
      {line.available ? <label className="mt-3 flex items-center gap-2">申请数量
        <input aria-label={`${line.title}申请数量`} type="number" min={0} max={line.maximumQuantity} value={quantities[line.lineId] ?? 0} onChange={(event) => actions.changeQuantity(line.lineId, Math.min(line.maximumQuantity, Math.max(0, Number(event.target.value) || 0)))} className="w-20 rounded border px-2 py-1" />
        {line.requiresReturn ? '需退回商品并通过验收' : '无需退回商品'}
      </label> : <p className="mt-2 font-bold text-amber-700">不可申请：{unavailable(line.unavailableReason)}</p>}
    </article>)}
    <label className="block font-bold">售后原因
      <select value={reason} onChange={(event) => actions.changeReason(event.target.value)} className="mt-1 w-full rounded-lg border p-2 font-normal">{afterSaleReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    </label>
    <label className="block font-bold">问题说明
      <textarea value={description} maxLength={2000} onChange={(event) => actions.changeDescription(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border p-2 font-normal" placeholder="请描述问题、发生时间和期望处理方式" />
    </label>
    <div>
      <b>图片/附件</b>
      <p className="mt-1 text-gray-400">附件使用 5 分钟短期签名直传，平台复核文件类型、大小、SHA-256 指纹和恶意文件扫描结果；同时最多上传 2 个。</p>
      <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 py-2 font-bold focus-within:ring-2 focus-within:ring-[var(--sw-brand)]">选择文件
        <input aria-label="选择售后附件" type="file" accept="image/jpeg,image/png,application/pdf" multiple className="sr-only" onChange={(event) => { actions.upload(event.target.files); event.target.value = ''; }} />
      </label>
      {attachments.map((item) => <div key={item.id} className="mt-1 flex items-center justify-between gap-3 rounded bg-gray-50 p-2"><span className="min-w-0 flex-1 truncate">{item.name}</span><span className={item.state === 'failed' ? 'text-red-600' : 'text-gray-500'}>{item.state === 'uploading' ? '正在安全上传…' : item.state === 'ready' ? '已上传并校验' : item.error ?? '上传失败'}</span><button type="button" onClick={() => actions.removeAttachment(item.id)} className="font-bold text-blue-700">移除</button></div>)}
    </div>
    <div className="rounded-lg bg-blue-50 p-3"><div className="flex items-center justify-between"><span>预计原路退回</span><b className="text-lg text-[var(--sw-brand)]">¥{formatMinor(expectedMinor)}</b></div><p className="mt-1 text-gray-500">最终按原支付媒介可退余额确定，拆分明细会写入退款时间线。</p></div>
    <button type="button" disabled={busy || selected.length === 0 || attachments.some(({ state }) => state !== 'ready')} onClick={actions.submit} className="w-full min-h-11 rounded-lg bg-[var(--sw-brand)] py-2.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? '正在安全提交…' : '提交售后申请'}</button>
  </>;
}

function unavailable(reason: string | null): string {
  return ({ NOT_FULFILLED: '商品尚未履约', PROVIDER_NOT_RETURNABLE: '供应商规则不支持', QUANTITY_EXHAUSTED: '可售后数量已用完', QUANTITY_EXCEEDED: '数量超过上限', AFTERSALE_WINDOW_EXPIRED: '已超过售后期限' } as Record<string, string>)[reason ?? ''] ?? '当前条件不满足';
}
