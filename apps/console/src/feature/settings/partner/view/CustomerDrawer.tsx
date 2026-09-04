import { Button, Drawer } from '@shop/design';
import { formatDate } from '../../../../shared/ui/Format';
import type { CustomerViewModel } from '../viewmodel/CustomerViewModel';
import { agreementText, customerKindText, customerStatusText } from './CustomerTable';

export function CustomerDrawer({ model }: Readonly<{ model: CustomerViewModel }>) {
  if (model.selection === undefined) return null;
  const customer = model.detail.value;
  return <Drawer open title={customer?.name ?? model.selection.name} onClose={model.actions.closeDetail}>
    <div className="partnerdetails">
      {model.detail.error ? <><p className="partnererror" role="alert">{model.detail.error}</p><Button onPress={model.detail.refresh}>重试客户详情</Button></> : null}
      {!customer && !model.detail.error ? <p role="status">正在读取客户详情…</p> : null}
      {customer ? <>
        <dl>
          <div><dt>客户类型</dt><dd>{customerKindText(customer.kind)}</dd></div>
          <div><dt>状态</dt><dd>{customerStatusText(customer.status)}</dd></div>
          <div><dt>客户识别号</dt><dd>{customer.identifierMasked}</dd></div>
          <div><dt>联系人</dt><dd>{customer.contacts.map((contact) => `${contact.nameMasked} · ${contact.phoneMasked ?? '无手机'} · ${contact.emailMasked ?? '无邮箱'}`).join('；') || '未配置'}</dd></div>
          <div><dt>合作协议</dt><dd>{customer.agreement ? `${agreementText(customer.agreement.status)} · ${customer.agreement.contractRef}` : '未配置'}</dd></div>
          <div><dt>协议有效期</dt><dd>{customer.agreement ? `${formatDate(customer.agreement.effectiveAt)} 至 ${formatDate(customer.agreement.expiresAt)}` : '—'}</dd></div>
          <div><dt>协议能力</dt><dd>{customer.agreement?.capabilities.join('、') || '—'}</dd></div>
          <div><dt>服务端版本</dt><dd>第 {customer.version} 版</dd></div>
          <div><dt>更新时间</dt><dd>{formatDate(customer.updatedAt)}</dd></div>
        </dl>
        <p className="partnerprivacy">字段权限已生效：识别号和联系人只返回脱敏值；编辑时敏感字段保持空白，只有明确重填才会由服务端加密替换。</p>
        {model.access.canUpdate ? <Button tone="primary" onPress={() => model.actions.edit(customer)}>编辑客户</Button> : null}
      </> : null}
    </div>
  </Drawer>;
}
