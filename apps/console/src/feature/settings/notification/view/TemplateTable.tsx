import { Button, DataTable, type DataColumn } from '@shop/design';
import { chineseDomainLabel } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { NotificationTemplate } from '../model/Template';
import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';

export function TemplateTable({ rows, model }: Readonly<{ rows: readonly NotificationTemplate[]; model: NotificationViewModel }>) {
  const columns: readonly DataColumn<NotificationTemplate>[] = [
    { key: 'event', label: '事件类型', render: (row) => <strong>{row.eventType}</strong> },
    { key: 'channel', label: '渠道', render: (row) => channelLabel(row.channel) },
    { key: 'purpose', label: '类型', render: (row) => row.purpose === 'marketing' ? '营销' : row.mandatory ? '交易 · 必达' : '交易与服务' },
    { key: 'provider', label: '供应商模板', render: (row) => row.providerTemplate ?? '站内模板' },
    { key: 'version', label: '内容版本', render: (row) => `v${row.version}` },
    { key: 'status', label: '状态', render: (row) => chineseDomainLabel(row.status) },
    { key: 'created', label: '创建时间', render: (row) => formatDate(row.createdAt) },
    {
      key: 'action',
      label: '操作',
      render: (row) =>
        model.canManage ? (
          <div className="notificationactions">
            {row.status !== 'retired' ? <Button onPress={() => model.actions.editTemplate(row)}>变更状态</Button> : null}
            <Button tone="primary" onPress={() => model.actions.reviseTemplate(row)}>
              新建版本
            </Button>
          </div>
        ) : null,
    },
  ];
  return <DataTable caption={model.section === 'sms' ? '短信模板配置' : '通知模板列表'} columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

export function channelLabel(value: NotificationTemplate['channel']): string {
  return { sms: '短信', email: '邮件', wechat: '微信', inapp: '站内信' }[value];
}
