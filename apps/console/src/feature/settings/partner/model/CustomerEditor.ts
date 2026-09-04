import type { Customer, CustomerAgreement, CustomerChange, CustomerContact, CustomerKind } from './Customer';

export interface CustomerProfileEditor {
  readonly mode: 'create' | 'update';
  readonly original?: Customer;
  readonly identifier: string;
  readonly name: string;
  readonly customerKind: CustomerKind;
  readonly contactMode: 'preserve' | 'replace';
  readonly contactKind: NonNullable<CustomerContact['kind']>;
  readonly contactName: string;
  readonly phone: string;
  readonly email: string;
  readonly agreementMode: 'none' | 'preserve' | 'replace';
  readonly contractRef: string;
  readonly contractHash: string;
  readonly capabilities: string;
  readonly effectiveDate: string;
  readonly expiryDate: string;
}

export interface CustomerStateEditor {
  readonly mode: 'enable' | 'disable';
  readonly original: Customer;
  readonly reason: string;
}

export type CustomerEditor = CustomerProfileEditor | CustomerStateEditor;

export function newCustomerEditor(): CustomerProfileEditor {
  return { mode: 'create', identifier: '', name: '', customerKind: 'enterprise', contactMode: 'replace', contactKind: 'primary', contactName: '', phone: '', email: '', agreementMode: 'none', contractRef: '', contractHash: '', capabilities: '', effectiveDate: '', expiryDate: '' };
}

export function editCustomerEditor(customer: Customer): CustomerProfileEditor {
  return { mode: 'update', original: customer, identifier: '', name: customer.name, customerKind: customer.kind, contactMode: 'preserve', contactKind: 'primary', contactName: '', phone: '', email: '', agreementMode: 'preserve', contractRef: '', contractHash: '', capabilities: '', effectiveDate: '', expiryDate: '' };
}

export function stateCustomerEditor(customer: Customer, mode: CustomerStateEditor['mode']): CustomerStateEditor {
  return { mode, original: customer, reason: '' };
}

export function validateCustomer(editor: CustomerEditor | undefined): string | undefined {
  if (editor === undefined) return undefined;
  if (isStateEditor(editor)) {
    if (editor.reason.trim().length < 4 || editor.reason.trim().length > 500) return '请填写 4 至 500 字的操作原因。';
    if (editor.mode === 'enable' && editor.original.agreement?.status !== 'active') return '启用前需要先维护当前有效的合作协议。';
    return undefined;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{4,63}$/.test(editor.identifier.trim()) && (editor.mode === 'create' || editor.identifier.trim())) return '客户识别号需为 5 至 64 位字母、数字、点或短横线。';
  if (editor.name.trim().length < 2 || editor.name.trim().length > 160) return '客户名称需为 2 至 160 个字符。';
  if (editor.contactMode === 'replace') {
    if (editor.contactName.trim().length < 1 || editor.contactName.trim().length > 128) return '联系人姓名需为 1 至 128 个字符。';
    if (!editor.phone.trim() && !editor.email.trim()) return '联系人手机或邮箱至少填写一项。';
    if (editor.phone.trim().length > 32 || editor.email.trim().length > 254) return '联系人手机或邮箱长度不正确。';
  }
  if (editor.agreementMode === 'replace') {
    if (editor.contractRef.trim().length < 1 || editor.contractRef.trim().length > 128) return '请填写有效的协议引用。';
    if (!/^[a-f0-9]{64}$/i.test(editor.contractHash.trim())) return '协议文件校验值必须为 64 位 SHA-256。';
    if (capabilityList(editor.capabilities).length === 0) return '请至少填写一项协议能力。';
    if (!validPeriod(editor.effectiveDate, editor.expiryDate)) return '协议生效日必须早于到期日。';
  }
  if (editor.mode === 'update' && !profileChanged(editor)) return '请先修改客户字段、联系人或协议。';
  return undefined;
}

export function rebaseCustomerEditor(editor: CustomerEditor, customer: Customer): CustomerEditor {
  return { ...editor, original: customer };
}

export function customerChange(editor: CustomerEditor): CustomerChange {
  if (isStateEditor(editor)) return { kind: editor.mode, customer: editor.original, reason: editor.reason.trim() };
  const contact = editor.contactMode === 'replace' ? customerContact(editor) : undefined;
  const agreement = editor.agreementMode === 'replace' ? customerAgreement(editor) : undefined;
  if (editor.mode === 'create') return { kind: 'create', body: { identifier: editor.identifier.trim(), name: editor.name.trim(), kind: editor.customerKind, contact: contact!, ...(agreement === undefined ? {} : { agreement }) } };
  return {
    kind: 'update', customer: editor.original!,
    body: {
      ...(editor.identifier.trim() ? { identifier: editor.identifier.trim() } : {}),
      ...(editor.name.trim() === editor.original!.name ? {} : { name: editor.name.trim() }),
      ...(editor.customerKind === editor.original!.kind ? {} : { kind: editor.customerKind }),
      ...(contact === undefined ? {} : { contact }),
      ...(agreement === undefined ? {} : { agreement }),
    },
  };
}

function customerContact(editor: CustomerProfileEditor): CustomerContact {
  return { kind: editor.contactKind, name: editor.contactName.trim(), ...(editor.phone.trim() ? { phone: editor.phone.trim() } : {}), ...(editor.email.trim() ? { email: editor.email.trim() } : {}) };
}
function customerAgreement(editor: CustomerProfileEditor): CustomerAgreement {
  return { contractRef: editor.contractRef.trim(), contractHash: editor.contractHash.trim().toLowerCase(), capabilities: capabilityList(editor.capabilities), effectiveAt: dateIso(editor.effectiveDate), expiresAt: dateIso(editor.expiryDate) };
}
function capabilityList(value: string): string[] {
  return [...new Set(value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))];
}
function dateIso(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}
function validPeriod(effective: string, expiry: string): boolean {
  const start = Date.parse(`${effective}T00:00:00.000Z`);
  const end = Date.parse(`${expiry}T00:00:00.000Z`);
  return Number.isFinite(start) && Number.isFinite(end) && start < end;
}
function profileChanged(editor: CustomerProfileEditor): boolean {
  return Boolean(editor.identifier.trim() || editor.name.trim() !== editor.original?.name || editor.customerKind !== editor.original.kind || editor.contactMode === 'replace' || editor.agreementMode === 'replace');
}
function isStateEditor(editor: CustomerEditor): editor is CustomerStateEditor {
  return editor.mode === 'enable' || editor.mode === 'disable';
}
