import { Button, Dialog } from '@shop/design';
import { useRef, useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { safeQueryError } from '../../shared/api/QueryState';
import { createOrdinaryAdminInvitation } from './MemberInvitationCommand';
import { MemberInvitationInputSchema, type MemberInvitationReceipt } from './MemberInvitationSchema';

export function MemberInvitationDialog({
  open,
  context,
  onClose,
}: Readonly<{
  open: boolean;
  context: ConsoleContext;
  onClose: () => void;
}>) {
  const formRef = useRef<HTMLFormElement>(null);
  const requestRef = useRef<AbortController | undefined>(undefined);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<MemberInvitationReceipt>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);

  const close = () => {
    requestRef.current?.abort();
    requestRef.current = undefined;
    submittingRef.current = false;
    setSubmitting(false);
    setReceipt(undefined);
    setError(undefined);
    setCopied(false);
    formRef.current?.reset();
    onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const values = new FormData(event.currentTarget);
    const input = MemberInvitationInputSchema.safeParse({
      label: values.get('label'),
      destination: values.get('destination'),
    });
    if (!input.success) {
      setError(input.error.issues[0]?.message ?? '请检查邀请信息');
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    submittingRef.current = true;
    setSubmitting(true);
    setError(undefined);
    setCopied(false);
    try {
      const nextReceipt = await createOrdinaryAdminInvitation(context, input.data, controller.signal);
      if (requestRef.current === controller) setReceipt(nextReceipt);
    } catch (cause) {
      if (requestRef.current === controller) setError(invitationError(cause));
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = undefined;
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  };

  const copy = async () => {
    if (receipt === undefined) return;
    if (navigator.clipboard === undefined) {
      setError('当前浏览器不支持一键复制，请手动复制邀请码。');
      return;
    }
    try {
      await navigator.clipboard.writeText(receipt.code);
      setCopied(true);
      setError(undefined);
    } catch {
      setError('复制失败，请手动复制邀请码。');
    }
  };

  return (
    <Dialog open={open} title="生成普通管理员邀请码" eyebrow="OWNER · SINGLE USE · 7 DAYS" onClose={close} dismissable={!submitting}>
      {receipt === undefined ? (
        <form ref={formRef} className="command" onSubmit={(event) => { void submit(event); }}>
          <p className="commandhint">邀请码固定创建普通管理员身份：可登录商城与后台，初始为 0 业务权限，需由 Owner 后续授权。</p>
          <label>
            <span>邀请标识</span>
            <input name="label" maxLength={80} required autoComplete="off" placeholder="例如：首轮平台主管邀请" disabled={submitting} />
          </label>
          <label>
            <span>受邀手机号</span>
            <input name="destination" inputMode="tel" maxLength={32} required autoComplete="tel" placeholder="例如：13800138000" disabled={submitting} />
          </label>
          <p className="muted">仅限该手机号注册；邀请码只能使用 1 次，并在生成后 7 天到期。</p>
          {error === undefined ? null : <p role="alert" className="capabilitynote">{error}</p>}
          <footer>
            <Button type="button" onPress={close} isDisabled={submitting}>取消</Button>
            <Button type="submit" tone="primary" isDisabled={submitting}>{submitting ? '正在生成…' : '生成邀请码'}</Button>
          </footer>
        </form>
      ) : (
        <section className="command" aria-label="邀请码生成结果">
          <p className="notice" role="status">普通管理员邀请码已生成。该邀请码关闭后不会再次显示。</p>
          <label>
            <span>邀请码</span>
            <input aria-label="邀请码" value={receipt.code} readOnly autoComplete="off" />
          </label>
          <p className="muted">邀请标识：{receipt.label} · 到期时间：{formatExpiry(receipt.expires_at)}</p>
          {error === undefined ? null : <p role="alert" className="capabilitynote">{error}</p>}
          <footer>
            <Button type="button" onPress={close}>关闭并清除</Button>
            <Button type="button" tone="primary" onPress={() => { void copy(); }}>{copied ? '已复制' : '复制邀请码'}</Button>
          </footer>
        </section>
      )}
    </Dialog>
  );
}

function invitationError(cause: unknown): string {
  const error = cause instanceof Error ? cause : new Error('INVITATION_CREATE_FAILED');
  if (error.message === 'SESSION_CSRF_REQUIRED') return '登录安全凭据已过期，请刷新页面后重试。';
  if (error.message === 'INVITATION_TENANT_SCOPE_REQUIRED') return '当前页面没有唯一的租户授权范围，请切换租户后重试。';
  const safe = safeQueryError(error);
  return safe === 'REQUEST_FAILED' ? '邀请码生成失败，请稍后重试。' : safe ?? '邀请码生成失败，请稍后重试。';
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false });
}
