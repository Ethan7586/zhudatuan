import { Button, DataTable, type DataColumn } from '@shop/design';
import { formatDate } from '../../../../shared/ui/Format';
import type { Customer } from '../model/Customer';
import type { CustomerViewModel } from '../viewmodel/CustomerViewModel';

export function CustomerTable({ rows, model }: Readonly<{ rows: readonly Customer[]; model: CustomerViewModel }>) {
  const columns: readonly DataColumn<Customer>[] = [
    { key: 'name', label: '客户', render: (row) => model.access.canGet ? <button className="partnerlink" onClick={() => model.actions.select(row)}>{row.name}</button> : row.name },
    { key: 'identifier', label: '识别号', render: (row) => row.identifierMasked },
    { key: 'kind', label: '类型', render: (row) => customerKindText(row.kind) },
    { key: 'contact', label: '主要联系人', render: (row) => contactText(row) },
    { key: 'agreement', label: '协议', render: (row) => row.agreement ? `${agreementText(row.agreement.status)} · ${formatDate(row.agreement.expiresAt)}` : '未配置' },
    { key: 'status', label: '状态', render: (row) => customerStatusText(row.status) },
    { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
    { key: 'actions', label: '操作', render: (row) => <CustomerActions customer={row} model={model} /> },
  ];
  return <DataTable caption="客户主数据" columns={columns} rows={rows} rowKey={(row) => row.id} />;
}

function CustomerActions({ customer, model }: Readonly<{ customer: Customer; model: CustomerViewModel }>) {
  return <div className="partneractions">
    {model.access.canGet ? <Button onPress={() => model.actions.select(customer)}>查看客户</Button> : null}
    {model.access.canUpdate ? <Button onPress={() => model.actions.edit(customer)}>编辑客户</Button> : null}
    {customer.status === 'active' && model.access.canDisable ? <Button tone="danger" onPress={() => model.actions.disable(customer)}>停用客户</Button> : null}
    {customer.status !== 'active' && model.access.canEnable ? <Button onPress={() => model.actions.enable(customer)}>启用客户</Button> : null}
  </div>;
}
function contactText(customer: Customer): string {
  const contact = customer.contacts[0];
  if (!contact) return '未配置';
  return [contact.nameMasked, contact.phoneMasked, contact.emailMasked].filter(Boolean).join(' · ');
}
export function customerKindText(value: Customer['kind']): string {
  return value === 'enterprise' ? '企业' : value === 'institution' ? '事业单位' : '政府机构';
}
export function customerStatusText(value: Customer['status']): string {
  return value === 'active' ? '合作中' : value === 'disabled' ? '已停用' : '待完善';
}
export function agreementText(value: NonNullable<Customer['agreement']>['status']): string {
  return value === 'active' ? '有效' : value === 'expired' ? '已到期' : value === 'terminated' ? '已终止' : '待生效';
}
