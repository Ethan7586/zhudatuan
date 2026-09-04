import type { Member, MemberChange, MemberImportSource, RegistrationResetDraft } from './Member';

export interface MemberEditor {
  readonly member: Member;
  readonly kind: 'profile' | 'status';
  readonly displayName: string;
  readonly status: 'active' | 'suspended' | 'left';
  readonly reason: string;
}

export interface MemberImportEditor {
  readonly file: MemberImportSource['file'] | null;
}

export type RegistrationResetEditor = RegistrationResetDraft;

export interface MemberManageInput {
  readonly change: MemberChange;
  readonly identity: string;
}

export interface MemberImportInput {
  readonly source: MemberImportSource;
  readonly identity: string;
}

export interface RegistrationResetInput {
  readonly draft: RegistrationResetDraft;
  readonly identity: string;
}

export function memberStatus(value: string): MemberEditor['status'] {
  return value === 'suspended' || value === 'left' ? value : 'active';
}

export function validateMember(editor: MemberEditor | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  if (editor.kind === 'profile' && (editor.displayName.trim().length === 0 || editor.displayName.trim().length > 128)) return '显示名称需为 1 至 128 个字符。';
  if (editor.kind === 'profile' ? editor.displayName.trim() === editor.member.displayName : editor.status === memberStatus(editor.member.membershipStatus)) return '请先修改成员资料或状态。';
  if (editor.reason.trim().length < 4 || editor.reason.trim().length > 1000) return '请填写 4 至 1000 字的审计原因。';
  return assurance < 2 ? '请先完成二次验证。' : undefined;
}

export function validateMemberImport(editor: MemberImportEditor | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  if (!editor.file) return '请选择 CSV 或 XLSX 文件。';
  return assurance < 2 ? '请先完成二次验证。' : undefined;
}

export function validateRegistrationReset(editor: RegistrationResetEditor | undefined, assurance: number): string | undefined {
  if (editor === undefined) return undefined;
  if (!editor.member.loginIdentityBound || !editor.member.registrationResetAllowed) return '该成员的注册身份受保护或已释放，不能重复重置。';
  if (assurance < 2) return '请先完成二次身份验证，再继续确认注册身份重置。';
  if (editor.reason.trim().length < 4 || editor.reason.trim().length > 500) return '请填写 4 至 500 字的操作原因。';
  if (!editor.understood) return '请确认你已理解本次身份重置的影响。';
  if (editor.confirmation !== '重置') return '请输入“重置”两个字确认。';
  if (editor.ownerPassword.length === 0 || editor.ownerPassword.length > 128) return '请输入当前所有者密码。';
  return undefined;
}
