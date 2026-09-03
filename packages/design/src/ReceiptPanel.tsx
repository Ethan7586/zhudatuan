import type { Receipt } from '@shop/presentation';
export function ReceiptPanel({ receipt }: Readonly<{ receipt: Receipt }>) {
  return <section className="receiptpanel" role="status" aria-live="polite"><h2>操作已完成</h2><p>{receipt.message}</p><dl><div><dt>业务编号</dt><dd>{receipt.reference}</dd></div><div><dt>请求编号</dt><dd>{receipt.requestId}</dd></div><div><dt>完成时间</dt><dd>{receipt.occurredAt}</dd></div></dl></section>;
}
