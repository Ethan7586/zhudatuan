import { Button, FilterBar, PageHeader, Pagination, ReceiptPanel, ResourceState } from '@shop/design';
import type { ChannelView } from '../model/Channel';
import type { ChannelViewModel } from '../viewmodel/ChannelViewModel';
import { ChannelActionDialog } from './ChannelActionDialog';
import { ChannelTable } from './ChannelTable';
import { ConnectionDialog } from './ConnectionDialog';

const labels: Readonly<Record<ChannelView, string>> = Object.freeze({ connections: '渠道连接', syncs: '同步批次', operations: '外部操作' });

export function ChannelPage({ title, model }: Readonly<{ title: string; model: ChannelViewModel }>) {
  return <section className="channelpage">
    <PageHeader eyebrow="Provider · 连接、同步与外部回执" title={title} description="11 个 MVP 服务商共享同一安全连接模型；密钥仅以引用提交，游标仅在服务端持久化成功后推进。" context={<p className="channelcontext">当前范围：{model.scope}</p>} actions={<>{model.permissions.create ? <Button tone="primary" onPress={model.actions.create}>创建连接</Button> : null}{model.permissions.startSync ? <Button onPress={() => model.actions.startSync()}>启动同步</Button> : null}<Button onPress={model.actions.refresh}>刷新</Button></>} />
    <FilterBar label="渠道视图"><label>查看<select value={model.view} onChange={(event) => model.actions.selectView(event.target.value as ChannelView)}>{model.availableViews.map((view) => <option key={view} value={view}>{labels[view]}</option>)}</select></label></FilterBar>
    <ResourceState condition={model.condition} {...(model.error ? { error: model.error } : {})} retry={model.actions.refresh} emptyTitle="暂无渠道记录" emptyMessage="当前范围还没有此类渠道数据；如有创建权限，可从页面右上角创建连接。">
      <div className="channelcontent"><ChannelTable model={model} /><footer><span>本页 {new Intl.NumberFormat('zh-CN').format(model.count)} 条</span><Pagination {...(model.nextCursor ? { next: model.nextCursor, onNext: model.actions.next } : {})} /></footer></div>
    </ResourceState>
    {model.receipt ? <div className="channelreceipt"><ReceiptPanel receipt={model.receipt} /><Button onPress={model.actions.dismissReceipt}>关闭回执</Button></div> : null}
    <ConnectionDialog model={model.action} onClose={model.actions.closeAction} /><ChannelActionDialog model={model.action} onClose={model.actions.closeAction} />
  </section>;
}
