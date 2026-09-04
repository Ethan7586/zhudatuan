import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { NotificationViewModel } from '../viewmodel/NotificationViewModel';
import { AnnouncementDialog } from './AnnouncementDialog';
import { AnnouncementTable } from './AnnouncementTable';
import { TemplateDialog } from './TemplateDialog';
import { TemplateTable } from './TemplateTable';
import '../Notification.css';

export function NotificationPage({ title, model }: Readonly<{ title: string; model: NotificationViewModel }>) {
  const page = model.section === 'announcements' ? model.announcements : model.templates;
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('通知管理')}
        description="模板、公告和短信配置来自通知服务；发布前完成变量校验、真实预览、高强度验证和双人复核。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <div className="notificationactions">
            {model.canManage ? (
              <Button tone="primary" onPress={model.actions.create}>
                {model.section === 'announcements' ? '新建公告' : model.section === 'sms' ? '新建短信模板' : '新建模板'}
              </Button>
            ) : null}
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
              {model.fetching ? '正在刷新…' : '刷新'}
            </Button>
          </div>
        }
        notice={
          <>
            <nav className="notificationsections" aria-label="通知管理类型">
              <Button tone={model.section === 'templates' ? 'primary' : 'default'} aria-pressed={model.section === 'templates'} onPress={() => model.actions.section('templates')}>
                全部模板
              </Button>
              <Button tone={model.section === 'sms' ? 'primary' : 'default'} aria-pressed={model.section === 'sms'} onPress={() => model.actions.section('sms')}>
                短信配置
              </Button>
              <Button tone={model.section === 'announcements' ? 'primary' : 'default'} aria-pressed={model.section === 'announcements'} onPress={() => model.actions.section('announcements')}>
                公告
              </Button>
            </nav>
            <section className="capabilitynote">
              <h2>{model.canManage ? '安全发布链路已开放' : '当前账号只有查看权限'}</h2>
              <p>{model.canManage ? '每次写入都绑定当前服务端版本、幂等标识和另一位管理员的复核凭证；提交成功后自动读取权威状态。' : '管理权限或能力不足时写入口直接消失；前端从不代替服务端授权。'}</p>
            </section>
          </>
        }
      >
        {page ? (
          <div className="featurestack">
            {model.section === 'announcements' && model.announcements ? <AnnouncementTable rows={model.announcements.items} model={model} /> : model.templates ? <TemplateTable rows={model.templates.items} model={model} /> : null}
            <div className="pagination">
              <span>本页 {page.count} 条</span>
              <div>
                {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                {page.nextCursor ? <Button onPress={() => model.actions.next(page.nextCursor ?? '')}>下一页</Button> : null}
              </div>
            </div>
          </div>
        ) : null}
      </ResourcePanel>
      {model.receipt ? (
        <section className="notificationreceipt" role="status">
          <strong>服务端已保存</strong>
          <span>
            {model.receipt.kind === 'template' ? '模板' : '公告'} {model.receipt.id} 当前为“{model.receipt.state}”，第 {model.receipt.version} 版；页面已完成权威重读。
          </span>
          <Button onPress={model.actions.dismissReceipt}>知道了</Button>
        </section>
      ) : null}
      <TemplateDialog model={model} />
      <AnnouncementDialog model={model} />
    </>
  );
}
