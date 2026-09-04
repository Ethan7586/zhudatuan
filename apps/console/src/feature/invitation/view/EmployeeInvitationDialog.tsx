import { Button, Dialog, Form } from '@shop/design';
import { useEffect, useMemo, useRef, useState } from 'react';
import { employeeInvitation, type EmployeeDraft, type InvitationDraft } from '../model/InvitationDraft';
import type { InvitationTarget } from '../model/InvitationTarget';

export interface InvitationDepartment {
  readonly id: string;
  readonly name: string;
}

export function EmployeeInvitationDialog({
  open,
  targets,
  departments,
  busy,
  error,
  onClose,
  onSubmit,
}: Readonly<{
  open: boolean;
  targets: readonly InvitationTarget[];
  departments: readonly InvitationDepartment[];
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (draft: InvitationDraft) => Promise<void>;
}>) {
  const [draft, setDraft] = useState<EmployeeDraft>(() => initialEmployee(targets));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setDraft((current) => (targets.some(({ id }) => id === current.organizationId) ? current : { ...current, organizationId: targets.length === 1 ? targets[0]!.id : '' }));
    first.current?.focus();
  }, [open, targets]);
  const valid = useMemo(() => validateEmployee(draft), [draft]);
  const update = (key: keyof EmployeeDraft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors(valid);
    if (Object.keys(valid).length > 0) return;
    await onSubmit(employeeInvitation(draft));
  };
  return (
    <Dialog open={open} title="邀请员工注册" eyebrow="普通员工 · 员工商城" onClose={onClose} dismissable={!busy}>
      <Form label="员工邀请" className="invitationform" onSubmit={(event) => void submit(event)} validationErrors={errors}>
        <p className="invitationlead">创建待激活员工档案，并生成只显示一次的邀请码。</p>
        {error === undefined ? null : (
          <p className="invitationerror" role="alert">
            {error}
          </p>
        )}
        <label htmlFor="employeeOrganization">入职商城</label>
        <select
          id="employeeOrganization"
          value={draft.organizationId}
          onChange={(event) => update('organizationId', event.target.value)}
          disabled={busy}
          required
          aria-describedby={errors.organizationId ? 'employeeOrganizationError' : undefined}
        >
          <option value="">请选择员工可以进入的商城</option>
          {targets.map((target) => (
            <option key={target.id} value={target.id}>
              {target.name}
            </option>
          ))}
        </select>
        {errors.organizationId ? (
          <span id="employeeOrganizationError" className="invitationfielderror">
            {errors.organizationId}
          </span>
        ) : null}
        <label htmlFor="employeeName">姓名</label>
        <input
          ref={first}
          id="employeeName"
          value={draft.displayName}
          onChange={(event) => update('displayName', event.target.value)}
          autoComplete="name"
          maxLength={80}
          disabled={busy}
          aria-describedby={errors.displayName ? 'employeeNameError' : undefined}
        />
        {errors.displayName ? (
          <span id="employeeNameError" className="invitationfielderror">
            {errors.displayName}
          </span>
        ) : null}
        <label htmlFor="employeeMobile">手机号</label>
        <input
          id="employeeMobile"
          value={draft.mobile}
          onChange={(event) => update('mobile', event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          maxLength={32}
          disabled={busy}
          aria-describedby={errors.mobile ? 'employeeMobileError' : undefined}
        />
        {errors.mobile ? (
          <span id="employeeMobileError" className="invitationfielderror">
            {errors.mobile}
          </span>
        ) : null}
        <div className="invitationgrid">
          <div>
            <label htmlFor="employeeNo">工号（选填）</label>
            <input id="employeeNo" value={draft.employeeNo} onChange={(event) => update('employeeNo', event.target.value)} maxLength={64} disabled={busy} />
          </div>
          <div>
            <label htmlFor="employeeDepartment">部门（选填）</label>
            <select id="employeeDepartment" value={draft.departmentId} onChange={(event) => update('departmentId', event.target.value)} disabled={busy}>
              <option value="">暂不指定</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <label htmlFor="employeeExpires">有效期</label>
        <input id="employeeExpires" type="datetime-local" value={localTime(draft.expiresAt)} onChange={(event) => update('expiresAt', new Date(event.target.value).toISOString())} disabled={busy} />
        <label htmlFor="employeeReason">邀请原因</label>
        <textarea id="employeeReason" value={draft.reason} onChange={(event) => update('reason', event.target.value)} minLength={4} maxLength={500} disabled={busy} aria-describedby={errors.reason ? 'employeeReasonError' : undefined} />
        {errors.reason ? (
          <span id="employeeReasonError" className="invitationfielderror">
            {errors.reason}
          </span>
        ) : null}
        <section className="invitationpreview" aria-label="固定权限预览">
          <strong>固定权限预览</strong>
          <span>普通员工，仅可访问员工商城</span>
          <small>员工不能通过邀请获得控制台权限，授权范围由服务端固定策略生成。</small>
        </section>
        <footer className="invitationactions">
          <Button onPress={onClose} isDisabled={busy}>
            取消
          </Button>
          <Button type="submit" tone="primary" isDisabled={busy}>
            {busy ? '正在创建…' : '创建员工邀请'}
          </Button>
        </footer>
      </Form>
    </Dialog>
  );
}

function initialEmployee(targets: readonly InvitationTarget[]): EmployeeDraft {
  return { organizationId: targets.length === 1 ? targets[0]!.id : '', displayName: '', mobile: '', employeeNo: '', departmentId: '', expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1_000).toISOString(), reason: '' };
}

function validateEmployee(draft: EmployeeDraft): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};
  if (draft.organizationId === '') errors.organizationId = '请选择员工可以进入的商城。';
  if (draft.displayName.trim().length < 2) errors.displayName = '请输入至少 2 个字符的员工姓名。';
  if (!/^\+?[0-9]{6,20}$/.test(draft.mobile.replace(/[\s-]/g, ''))) errors.mobile = '请输入有效手机号。';
  if (draft.reason.trim().length < 4) errors.reason = '请填写至少 4 个字符的邀请原因。';
  if (new Date(draft.expiresAt).getTime() <= Date.now()) errors.expiresAt = '失效时间必须晚于当前时间。';
  return errors;
}

function localTime(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
