import { Button, Dialog } from '@shop/design';
import { useState, type FormEvent } from 'react';
import type { ConsoleScope } from '../../entity/session/ConsoleSession';
import type { CreatedMall, MallCreateDraft } from './MallCreateCommand';

export type MallCreatePhase = 'form' | 'starting' | 'verification' | 'verifying' | 'creating' | 'success';
const MALL_CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,31}$/;
const MALL_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,47}$/;
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
  onSubmit,
  onVerify,
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
  onSubmit: (draft: MallCreateDraft) => void;
  onVerify: (code: string) => void;
  onClose: () => void;
}>) {
  const [enterpriseId, setEnterpriseId] = useState(() => preferredEnterpriseId ?? enterprises[0]?.id ?? '');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const busy = phase === 'starting' || phase === 'verifying' || phase === 'creating';

  const valid = enterpriseId !== '' && name.trim().length > 0
    && MALL_CODE_PATTERN.test(code)
    && MALL_SLUG_PATTERN.test(publicSlug);

  return <Dialog open={open} title={dialogTitle(phase)} eyebrow="zhudatuan 主打团 · 商城管理"
    dismissable={!busy} onClose={onClose}>
    {phase === 'success' && result !== undefined
      ? <Success result={result} onClose={onClose} />
      : phase === 'verification' || phase === 'verifying'
        ? <Verification code={verificationCode} expiresAt={challengeExpiresAt} busy={busy} error={error}
            onCode={setVerificationCode} onVerify={onVerify} onClose={onClose} />
        : <form className="command" onSubmit={(event) => submitMall(event, valid, { enterpriseId, name, code, publicSlug }, onSubmit)}>
          <p className="commandhint">一次提交建立商城身份、组织归属、独立商品池和开店草稿；任一步失败都会整体回滚。</p>
          {!available ? <p className="notice" role="status">当前范围没有商城创建能力，请切换到平台控制范围。</p> : null}
          {enterprises.length === 0 ? <p className="notice" role="status">当前没有可用于建店的集团范围。</p> : null}
          <div className="fieldgrid">
            <label>所属集团
              <select aria-label="所属集团" value={enterpriseId} disabled={busy} required
                onChange={(event) => setEnterpriseId(event.target.value)}>
                <option value="">请选择集团</option>
                {enterprises.map((enterprise) => <option key={enterprise.id} value={enterprise.id}>{enterprise.name ?? enterprise.id}</option>)}
              </select>
            </label>
            <label>商城名称
              <input aria-label="商城名称" value={name} maxLength={120} disabled={busy} required placeholder="例如：甄选商城"
                onChange={(event) => setName(event.target.value)} />
            </label>
            <label>商城代码
              <input aria-label="商城代码" value={code} maxLength={32} disabled={busy} required placeholder="例如：ZHENXUAN"
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} />
              <small className="muted">3～32 位，以字母开头，只使用大写字母、数字和下划线。</small>
            </label>
            <label>访问标识
              <input aria-label="访问标识" value={publicSlug} maxLength={48} disabled={busy} required placeholder="例如：zhenxuan"
                onChange={(event) => setPublicSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
              <small className="muted">3～48 位，用于商城访问地址，只使用小写字母、数字和短横线。</small>
            </label>
          </div>
          {error === undefined ? null : <p className="notice" role="alert">{error}</p>}
          <footer><Button onPress={onClose} isDisabled={busy}>取消</Button>
            <Button type="submit" tone="primary" isDisabled={!available || !valid || busy}>
              {phase === 'starting' ? '发送验证码中' : phase === 'creating' ? '创建中' : '确认创建'}
            </Button></footer>
        </form>}
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
      <div><dt>访问标识</dt><dd>{result.publicSlug}</dd></div>
      <div><dt>商品池</dt><dd>{result.poolId}</dd></div>
      <div><dt>发布状态</dt><dd>草稿，等待店铺装修</dd></div>
    </dl>
    <footer><Button tone="primary" onPress={onClose}>完成</Button></footer>
  </section>;
}

function submitMall(event: FormEvent<HTMLFormElement>, valid: boolean, draft: MallCreateDraft, onSubmit: (draft: MallCreateDraft) => void) {
  event.preventDefault();
  if (valid) onSubmit(draft);
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
