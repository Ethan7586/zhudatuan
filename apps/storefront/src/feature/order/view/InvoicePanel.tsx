import { CircleAlert, Download, FileCheck2, LoaderCircle, ReceiptText } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import { formatMinor } from '../../../shared/format/Money';
import type { useInvoiceViewModel } from '../viewmodel/InvoiceViewModel';

export function InvoicePanel({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useInvoiceViewModel> }>) {
  const { state, invoices, busy, message, actions } = viewmodel;

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black">
            <ReceiptText size={18} />
            我的电子发票
          </h2>
          <p className="mt-1 text-xs text-gray-500">仅展示当前成员的真实开票记录；下载链接五分钟内有效。</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{invoices.length} 张</span>
      </header>
      {message ? (
        <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">
          <CircleAlert size={16} />
          {message}
        </div>
      ) : null}
      {state === 'loading' ? <State text="正在读取发票记录…" /> : null}
      {invoices.map((invoice) => (
        <article key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 text-xs shadow-sm">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <FileCheck2 size={18} />
            </span>
            <div className="min-w-0">
              <b className="block truncate text-sm">
                {invoice.kind === 'red' ? '红字电子发票' : '电子发票'} · {chineseReference('发票', invoice.id)}
              </b>
              <p className="mt-1 text-gray-500">
                申请 {format(invoice.createdAt)}
                {invoice.issuedAt ? ` · 开具 ${format(invoice.issuedAt)}` : ''}
              </p>
              <p className="mt-1 text-gray-400">
                状态 {stateLabel(invoice.state)}
                {invoice.sha256 ? ` · ${chineseReference('校验记录', invoice.sha256)}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <b className="text-base">¥{formatMinor(invoice.amountMinor)}</b>
            <button
              type="button"
              disabled={!invoice.downloadable || busy !== null}
              onClick={() => void actions.download(invoice.id)}
              className="inline-flex items-center gap-1 rounded-lg bg-[var(--sw-brand)] px-3 py-2 font-bold text-white disabled:bg-gray-300"
            >
              <Download size={14} />
              {busy === invoice.id ? '获取中…' : invoice.downloadable ? '下载电子发票' : '尚未开具'}
            </button>
          </div>
        </article>
      ))}
      {state === 'empty' ? <State text="暂无发票记录" idle /> : null}
    </section>
  );
}

function State({ text, idle = false }: { readonly text: string; readonly idle?: boolean }) {
  return (
    <div role="status" className="grid min-h-40 place-items-center rounded-xl border border-dashed bg-white text-xs text-gray-400">
      <span className="inline-flex items-center gap-2">
        {idle ? <ReceiptText size={17} /> : <LoaderCircle className="animate-spin" size={17} />}
        {text}
      </span>
    </div>
  );
}
function format(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
function stateLabel(value: string) {
  return ({ submitted: '已申请', approved: '待开具', issuing: '开具中', issued: '已开具', rejected: '已拒绝', cancelled: '已取消', failed: '开具失败', red: '已红冲' } as Record<string, string>)[value] ?? '待识别状态';
}
