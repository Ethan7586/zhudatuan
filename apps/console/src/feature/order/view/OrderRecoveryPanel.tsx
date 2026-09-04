import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import type { OrderRecovery, OrderRecoveryState } from '../model/Order';
import { formatOrderTime, recoveryLabel, recoveryResourceLabel } from './OrderPresentation';
import { OrderDetailEmpty, OrderDetailSection } from './OrderDetailSection';

export function OrderRecoveryPanel({ state, canResolve, onResolve, onRetry }: Readonly<{
  state: OrderRecoveryState;
  canResolve: boolean;
  onResolve: (recovery: OrderRecovery) => void;
  onRetry: () => void;
}>) {
  if (state.state === 'hidden') return null;
  return (
    <OrderDetailSection title="支付恢复事项">
      {state.state === 'loading' ? <p role="status">正在读取支付恢复事项…</p> : null}
      {state.state === 'unavailable' ? <section className="orderdrawererror" role="alert"><strong>支付恢复事项暂时不可用</strong><p>{state.error.message}</p>{state.error.traceId ? <small>请求追踪：{state.error.traceId}</small> : null}{state.error.retryable ? <button type="button" onClick={onRetry}>仅重试支付恢复</button> : null}</section> : null}
      {state.state === 'ready' && state.data.items.length === 0 ? <OrderDetailEmpty text="本单没有支付恢复事项。" /> : null}
      {state.state === 'ready' ? state.data.items.map((item) => (
        <article className="orderreadcard" key={item.id}>
          <strong>{recoveryLabel(item.errorCode)} · {item.severity === 'critical' ? '紧急' : '高优先级'}</strong>
          <small>{formatOrderTime(item.openedAt)} · 已出现 {item.occurrenceCount} 次 · {chineseDomainLabel(item.state)}</small>
          <span>{chineseReference(recoveryResourceLabel(item.resourceType), item.resourceId)}</span>
          {item.state === 'open' && canResolve ? <button type="button" onClick={() => onResolve(item)}>处理恢复事项</button> : null}
        </article>
      )) : null}
    </OrderDetailSection>
  );
}
