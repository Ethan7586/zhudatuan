import type { Receipt as ReceiptModel } from '@shop/presentation';
import type { ReactNode } from 'react';
import './Receipt.css';

export interface ReceiptDetail {
  readonly label: string;
  readonly value: ReactNode;
}

export interface ReceiptProps {
  readonly receipt: ReceiptModel;
  readonly objectLabel?: string;
  readonly impact?: string;
  readonly details?: readonly ReceiptDetail[];
  readonly heading?: string;
  readonly next?: ReactNode | null;
  readonly tone?: 'success' | 'warning' | 'danger' | 'neutral';
}

export function Receipt({ receipt, objectLabel = '业务对象', impact, details = [], heading = '操作已完成', next, tone = 'success' }: Readonly<ReceiptProps>) {
  const nextStep = next === undefined ? receipt.next : next;
  return (
    <section className="shopreceipt" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'} aria-live={tone === 'danger' ? 'assertive' : 'polite'}>
      <header>
        <span className="shopreceiptmark" aria-hidden="true">{tone === 'success' ? '✓' : tone === 'warning' ? '!' : tone === 'danger' ? '×' : '•'}</span>
        <div>
          <h2>{heading}</h2>
          <p>{receipt.message}</p>
        </div>
      </header>
      <dl className="shopreceiptgrid">
        <ReceiptItem label={objectLabel} value={receipt.reference} />
        {impact === undefined ? null : <ReceiptItem label="影响范围" value={impact} />}
        {details.map((detail, index) => <ReceiptItem key={`${detail.label}:${index}`} label={detail.label} value={detail.value} />)}
        <ReceiptItem label="完成时间" value={<time dateTime={receipt.occurredAt}>{formatTime(receipt.occurredAt)}</time>} />
        <ReceiptItem label="请求编号" value={<code>{receipt.requestId}</code>} />
        {nextStep === null || nextStep === undefined ? null : <ReceiptItem label="下一步" value={renderNext(nextStep)} />}
      </dl>
    </section>
  );
}

function ReceiptItem({ label, value }: Readonly<ReceiptDetail>) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function renderNext(next: ReactNode | Readonly<{ label: string; target: string }>): ReactNode {
  if (typeof next === 'object' && next !== null && 'label' in next && 'target' in next) {
    const target = safeTarget(next.target);
    return target === undefined ? next.label : <a href={target}>{next.label}</a>;
  }
  return next;
}

function safeTarget(value: string): string | undefined {
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('#') && !value.startsWith('#javascript:')) return value;
  return undefined;
}

function formatTime(value: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp);
}
