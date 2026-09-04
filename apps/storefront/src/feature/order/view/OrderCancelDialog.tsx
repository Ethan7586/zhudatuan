import { CircleAlert, X } from 'lucide-react';
import type { useOrderDetailViewModel } from '../viewmodel/OrderDetailViewModel';

export function OrderCancelDialog({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useOrderDetailViewModel> }>) {
  const editor = viewmodel.cancel;
  if (!editor) return null;
  const validation = editor.reason.trim().length < 2 ? '请填写至少 2 个字符的取消原因。' : !editor.confirmed ? '请确认已了解取消后的影响。' : undefined;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-brand-ink/55 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="order-cancel-title" className="w-full max-w-md overflow-hidden rounded-3xl border border-edge bg-surface shadow-2xl">
        <header className="relative border-b border-edge bg-subtle px-6 py-5">
          <button type="button" aria-label="关闭取消订单确认" disabled={viewmodel.busy === 'cancel'} onClick={viewmodel.actions.closeCancel} className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-surface disabled:opacity-50"><X size={18} /></button>
          <p className="text-xs font-bold text-danger-strong">订单状态变更 · 版本校验</p>
          <h2 id="order-cancel-title" className="mt-1 text-xl font-black">取消待付款订单</h2>
        </header>
        <form className="space-y-4 p-6" onSubmit={(event) => { event.preventDefault(); void viewmodel.actions.submitCancel(); }}>
          <div className="flex gap-3 rounded-2xl bg-warning-surface p-4 text-sm text-warning-strong"><CircleAlert className="mt-0.5 shrink-0" size={18} /><p>仅能取消尚未支付且尚未开始履约的订单。提交后订单不可恢复；服务端会再次核对当前版本，避免覆盖刚发生的支付结果。</p></div>
          <label className="block text-sm font-bold">取消原因<textarea aria-label="取消原因" rows={3} maxLength={1000} value={editor.reason} onChange={(event) => viewmodel.actions.cancelReason(event.target.value)} placeholder="例如：收货信息有误，需要重新下单" className="mt-2 w-full rounded-xl border border-edge-strong px-4 py-3 font-normal outline-none focus:border-brand focus:ring-4 focus:ring-brand-light" /></label>
          <label className="flex items-start gap-2 text-sm"><input aria-label="确认取消影响" type="checkbox" checked={editor.confirmed} onChange={(event) => viewmodel.actions.cancelConfirmed(event.target.checked)} className="mt-1" /><span>我已确认本单尚未支付、尚未履约，并了解取消后不能恢复。</span></label>
          {viewmodel.error ? <p role="alert" className="rounded-xl bg-danger-surface p-3 text-xs font-bold text-danger-strong">{viewmodel.error}</p> : validation ? <p className="text-xs text-muted">{validation}</p> : null}
          <footer className="grid grid-cols-2 gap-3"><button type="button" disabled={viewmodel.busy === 'cancel'} onClick={viewmodel.actions.closeCancel} className="rounded-xl border border-edge-strong px-4 py-3 text-sm font-bold disabled:opacity-50">保留订单</button><button type="submit" disabled={viewmodel.busy !== null || validation !== undefined} className="rounded-xl bg-danger px-4 py-3 text-sm font-black text-inverse disabled:opacity-50">{viewmodel.busy === 'cancel' ? '正在核对并取消…' : '确认取消订单'}</button></footer>
        </form>
      </section>
    </div>
  );
}
