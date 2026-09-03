import { Button, ResourceState, type ResourceCondition } from '@shop/design';
import { chineseReference } from '@shop/presentation';
import type { HistoryItem } from '../model/History';
import { formatTime } from './SupportPresentation';

export function HistoryPanel({
  open,
  items,
  condition,
  error,
  nextCursor,
  onClose,
  onNext,
  onRetry,
}: Readonly<{ open: boolean; items: readonly HistoryItem[]; condition: ResourceCondition; error?: string | undefined; nextCursor?: string | undefined; onClose: () => void; onNext: () => void; onRetry: () => void }>) {
  if (!open) return null;
  return (
    <aside className="supporthistory" aria-label="工单历史">
      <header>
        <div>
          <p>客服服务记录</p>
          <h2>工单历史</h2>
        </div>
        <Button onPress={onClose} aria-label="关闭历史">
          ×
        </Button>
      </header>
      <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={onRetry}>
        <ol>
          {items.map((item) => (
            <li key={item.cursorId}>
              <span>{item.sequence}</span>
              <div>
                <strong>{historyLabel(item.kind)}</strong>
                <p>{chineseReference('操作人', item.actorId)}</p>
                <time dateTime={item.occurredAt}>{formatTime(item.occurredAt)}</time>
              </div>
            </li>
          ))}
        </ol>
      </ResourceState>
      {nextCursor ? <Button onPress={onNext}>加载更多历史</Button> : null}
    </aside>
  );
}
function historyLabel(value: string): string {
  return ({ opened: '创建工单', message: '发送消息', assigned: '转派工单', closed: '关闭工单', reopened: '重新打开', updated: '更新工单', 'sla.escalated': '服务时限升级' } as Record<string, string>)[value] ?? '工单状态更新';
}
