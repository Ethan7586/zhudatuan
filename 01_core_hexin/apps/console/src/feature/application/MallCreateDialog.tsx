import { Button, Dialog } from '@shop/design';
import { useState } from 'react';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import type { CreatedMall, MallCreateDraft } from './MallCreateCommand';
import { initialMallOpeningDraft, MallCreateJourney, mallCoreDraft, type MallOpeningDraft } from './MallCreateJourney';
import { MallMobileEnrollment } from './MallMobileEnrollment';

export type MallCreatePhase = 'form' | 'starting' | 'verification' | 'verifying' | 'creating' | 'success';
const MALL_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,31}$/;
const OTP_PATTERN = /^\d{6}$/;

export function MallCreateDialog({
  open,
  phase,
  enterprises,
  preferredEnterpriseId,
  available,
  challengeExpiresAt,
  error,
  result,
  context,
  mobileEnrollment,
  onSubmit,
  onVerify,
  onRelogin,
  onClose,
}: Readonly<{
  open: boolean;
  phase: MallCreatePhase;
  enterprises: readonly ConsoleScope[];
  preferredEnterpriseId: string | undefined;
  available: boolean;
  challengeExpiresAt: string | undefined;
  error: string | undefined;
  result: CreatedMall | undefined;
  context: ConsoleContext;
  mobileEnrollment: boolean;
  onSubmit: (draft: MallCreateDraft) => void;
  onVerify: (code: string) => void;
  onRelogin: () => void;
  onClose: () => void;
}>) {
  const [draft, setDraft] = useState(() => initialMallOpeningDraft(preferredEnterpriseId ?? enterprises[0]?.id ?? ''));
  const [verificationCode, setVerificationCode] = useState('');
  const busy = phase === 'starting' || phase === 'verifying' || phase === 'creating';

  const valid = draft.enterpriseId !== '' && draft.name.trim().length > 0
    && MALL_CODE_PATTERN.test(draft.code);
  const updateDraft = (field: keyof MallOpeningDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  return <Dialog open={open} title={dialogTitle(phase)} eyebrow="zhudatuan 主打团 · 商城管理"
    dismissable={!busy} onClose={onClose}>
    {mobileEnrollment
      ? <MallMobileEnrollment context={context} onRelogin={onRelogin} />
      : phase === 'success' && result !== undefined
      ? <Success result={result} onClose={onClose} />
      : phase === 'verification' || phase === 'verifying'
        ? <Verification code={verificationCode} expiresAt={challengeExpiresAt} busy={busy} error={error}
            onCode={setVerificationCode} onVerify={onVerify} onClose={onClose} />
        : <MallCreateJourney draft={draft} enterprises={enterprises} available={available} busy={busy} valid={valid}
            error={error} onChange={updateDraft} onSubmit={() => onSubmit(mallCoreDraft(draft))} onClose={onClose} />}
  </Dialog>;
}

function Verification({ code, expiresAt, busy, error, onCode, onVerify, onClose }: Readonly<{
  code: string;
  expiresAt: string | undefined;
  busy: boolean;
  error: string | undefined;
  onCode: (value: string) => void;
  onVerify: (code: string) => void;
  onClose: () => void;
}>) {
  return <form className="command" onSubmit={(event) => {
    event.preventDefault();
    if (OTP_PATTERN.test(code)) onVerify(code);
  }}>
    <p className="commandhint">验证码已发送到当前账号绑定手机。验证成功后会立即创建商城，无需再次提交表单。</p>
    {expiresAt === undefined ? null : <p className="muted">验证码有效期至 {formatExpiry(expiresAt)}</p>}
    <label>六位验证码
      <input aria-label="六位验证码" inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6}
        disabled={busy} onChange={(event) => onCode(event.target.value.replace(/\D/g, ''))} />
    </label>
    {error === undefined ? null : <p className="notice" role="alert">{error}</p>}
    <footer><Button onPress={onClose} isDisabled={busy}>取消</Button>
      <Button type="submit" tone="primary" isDisabled={busy || !OTP_PATTERN.test(code)}>{busy ? '验证并创建中' : '验证并创建'}</Button></footer>
  </form>;
}

function Success({ result, onClose }: Readonly<{ result: CreatedMall; onClose: () => void }>) {
  return <section className="command">
    <p className="notice" role="status">商城已创建，商城清单正在刷新。</p>
    <dl className="commercefacts">
      <div><dt>商城名称</dt><dd>{result.name}</dd></div>
      <div><dt>商城代码</dt><dd>{result.code}</dd></div>
      <div><dt>商城 ID</dt><dd>{result.mallId}</dd></div>
      <div><dt>H5 地址</dt><dd>{result.publicSlug}.hbbtzn.com</dd></div>
      <div><dt>商品池</dt><dd>{result.poolId}</dd></div>
      <div><dt>发布状态</dt><dd>草稿，等待店铺装修</dd></div>
    </dl>
    <footer><Button tone="primary" onPress={onClose}>完成</Button></footer>
  </section>;
}

function dialogTitle(phase: MallCreatePhase): string {
  if (phase === 'success') return '商城创建完成';
  if (phase === 'verification' || phase === 'verifying') return '验证后创建商城';
  return '创建商城';
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
