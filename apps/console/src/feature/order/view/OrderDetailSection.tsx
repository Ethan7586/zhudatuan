import type { ReactNode } from 'react';
import { OrderIcon } from './OrderIcon';
import type { OrderDetailSectionState } from '../model/Order';

export function OrderDetailSection({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return (
    <section className="orderdetailsection">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function OrderDetailInfo({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function OrderDetailEmpty({ text }: Readonly<{ text: string }>) {
  return (
    <p className="orderunavailable">
      <OrderIcon name="clock" />
      {text}
    </p>
  );
}

export function OrderSectionState({ section, title, onRetry }: Readonly<{ section: OrderDetailSectionState<unknown>; title: string; onRetry: (() => void) | undefined }>) {
  if (section.state === 'ready') return null;
  if (section.state === 'hidden') return null;
  return <section className="ordersectionstate iserror" role="alert"><OrderIcon name="warning" /><span><strong>{title}暂时不可用</strong><small>{section.error.message || '依赖投影暂时不可用，订单其他事实未受影响。'}</small>{section.error.traceId ? <small>请求追踪号：{section.error.traceId}</small> : null}{section.error.retryable && onRetry ? <button type="button" onClick={onRetry}>仅重试此分区</button> : null}</span></section>;
}
