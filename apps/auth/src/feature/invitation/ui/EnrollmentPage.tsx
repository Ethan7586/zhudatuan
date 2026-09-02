import { Button, Dialog, Form } from '@shop/design';
import { useEffect, useRef, useState } from 'react';
import type { ChallengeRequest, EnrollmentCompletion } from '../../../entity/authentication/AuthClient';
import { challengeNotice } from '../../../shared/challenge/ChallengePolicy';
import { useChallengeCooldown } from '../../../shared/challenge/useChallengeCooldown';
import type { EnrollmentState } from '../model/Enrollment';
import { canEditDisplayName } from '../model/RegistrationPolicy';
import { InvitationError } from './InvitationError';
import { MobileProof } from './MobileProof';
import { PasswordForm } from './PasswordForm';
import './Enrollment.css';

interface EnrollmentFormState {
  readonly displayName: string;
  readonly mobile: string;
  readonly code: string;
  readonly password: string;
  readonly confirm: string;
}

export function EnrollmentPage({ enrollment, createChallenge, onComplete, onClose }: Readonly<{
  enrollment: EnrollmentState;
  createChallenge: (request: ChallengeRequest) => Promise<Readonly<{ id: string; expiresAt: string }>>;
  onComplete: (input: EnrollmentCompletion) => Promise<void>;
  onClose: () => void;
}>) {
  const bound = enrollment.subjectMode === 'bound';
  const [form, setForm] = useState<EnrollmentFormState>(() => initial(enrollment));
  const [challenge, setChallenge] = useState('');
  const [challengeSubject, setChallengeSubject] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [policy, setPolicy] = useState<'terms' | 'privacy'>();
  const [busy, setBusy] = useState<'code' | 'submit'>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const first = useRef<HTMLInputElement>(null);
  const cooldown = useChallengeCooldown();
  useEffect(() => first.current?.focus(), []);
  const update = (key: keyof EnrollmentFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === 'mobile') {
      setChallenge('');
      setChallengeSubject('');
      cooldown.clear();
    }
    setError('');
  };
  const send = async () => {
    if (!bound && !/^\+?\d{8,20}$/.test(form.mobile.trim())) return setError('请输入有效手机号。');
    setBusy('code');
    setError('');
    try {
      const request: ChallengeRequest = bound
        ? { purpose: 'enrollment', enrollmentId: enrollment.id }
        : { purpose: 'enrollment_campaign', enrollmentId: enrollment.id, destination: form.mobile.trim() };
      const result = await createChallenge(request);
      setChallenge(result.id);
      setChallengeSubject(bound ? enrollment.id : form.mobile.trim());
      update('code', '');
      cooldown.start();
      setNotice(challengeNotice());
    } catch (cause) {
      setError(message(cause, '验证码发送失败，请稍后重试。'));
    } finally {
      setBusy(undefined);
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const subject = bound ? enrollment.id : form.mobile.trim();
    if (!challenge || challengeSubject !== subject) return setError('请先为当前邀请获取验证码。');
    if (!/^\d{6}$/.test(form.code)) return setError('请输入 6 位短信验证码。');
    if (form.displayName.trim().length < 2) return setError('请输入真实姓名。');
    if (!accepted) return setError('请先阅读并同意服务协议与隐私政策。');
    if (!strong(form.password)) return setError('密码须为 12–128 位，并同时包含大小写字母、数字和符号。');
    if (form.password !== form.confirm) return setError('两次输入的密码不一致。');
    setBusy('submit');
    setError('');
    try {
      await onComplete({
        id: enrollment.id,
        subjectMode: enrollment.subjectMode,
        ...(!bound ? { subject: form.mobile.trim() } : {}),
        challenge,
        code: form.code,
        password: form.password,
        displayName: form.displayName.trim(),
        termsHash: enrollment.policy.termsHash,
      });
      setForm(initial(enrollment));
      setAccepted(false);
      setChallenge('');
    } catch (cause) {
      setError(message(cause, '注册失败，请检查后重试。'));
    } finally {
      setBusy(undefined);
    }
  };
  const close = () => {
    if (busy) return;
    setForm(initial(enrollment));
    setChallenge('');
    setAccepted(false);
    onClose();
  };
  return (
    <>
      <Dialog open title="注册员工商城账号" eyebrow="员工邀请" onClose={close} dismissable={busy === undefined}>
        <Form label="员工注册" className="enrollmentform" onSubmit={(event) => void submit(event)}>
          <header className="enrollmentintro">
            <div><span>第一步</span><h3>{enrollment.organization.name}</h3></div>
            <p>验证邀请绑定的手机号，设置密码后即可进入员工商城。</p>
            <dl><div><dt>邀请类型</dt><dd>{bound ? '指定员工邀请' : '共享注册邀请'}</dd></div><div><dt>有效期至</dt><dd>{format(enrollment.expiresAt)}</dd></div>{enrollment.employee?.employeeNo ? <div><dt>员工编号</dt><dd>{enrollment.employee.employeeNo}</dd></div> : null}</dl>
          </header>
          {error ? <InvitationError message={error} /> : null}
          {notice ? <p className="enrollmentnotice" role="status">{notice}</p> : null}
          <label htmlFor="enrollmentName">姓名</label>
          <input ref={first} id="enrollmentName" value={form.displayName} onChange={(event) => update('displayName', event.target.value)} maxLength={80} autoComplete="name" readOnly={!canEditDisplayName(enrollment.subjectMode)} disabled={busy !== undefined} required />
          {!canEditDisplayName(enrollment.subjectMode) ? <small className="enrollmenthint">姓名来自员工邀请，如需修改请联系管理员。</small> : null}
          <MobileProof bound={bound} {...(enrollment.recipientMasked === undefined ? {} : { masked: enrollment.recipientMasked })} mobile={form.mobile} code={form.code} challengeReady={challenge !== ''} busy={busy !== undefined} seconds={cooldown.seconds} onMobile={(value) => update('mobile', value)} onCode={(value) => update('code', value)} onSend={() => void send()} />
          <PasswordForm password={form.password} confirm={form.confirm} busy={busy !== undefined} onPassword={(value) => update('password', value)} onConfirm={(value) => update('confirm', value)} />
          <label className="enrollmentagreement"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy !== undefined} /><span>我已阅读并同意 <button type="button" onClick={() => setPolicy('terms')}>《{enrollment.policy.termsTitle}》</button>和<button type="button" onClick={() => setPolicy('privacy')}>《{enrollment.policy.privacyTitle}》</button></span></label>
          <Button type="submit" tone="primary" isDisabled={busy !== undefined || challenge === '' || !accepted}>{busy === 'submit' ? '正在创建账号…' : '创建普通员工账号'}</Button>
          <p className="enrollmenthint">密码和验证码不会写入浏览器长期存储。注册仅开通员工商城，控制台权限需另行授权。</p>
        </Form>
      </Dialog>
      <PolicyDialog enrollment={enrollment} kind={policy} onClose={() => setPolicy(undefined)} />
    </>
  );
}

function PolicyDialog({ enrollment, kind, onClose }: Readonly<{ enrollment: EnrollmentState; kind?: 'terms' | 'privacy'; onClose: () => void }>) {
  const selected = kind === 'terms' ? [enrollment.policy.termsTitle, enrollment.policy.termsBody] : [enrollment.policy.privacyTitle, enrollment.policy.privacyBody];
  return <Dialog open={kind !== undefined} title={selected[0]} eyebrow="注册政策" onClose={onClose}><div className="enrollmentpolicy">{selected[1]}<Button tone="primary" onPress={onClose}>已阅读</Button></div></Dialog>;
}
function initial(enrollment: EnrollmentState): EnrollmentFormState { return { displayName: enrollment.employee?.displayName ?? '', mobile: '', code: '', password: '', confirm: '' }; }
function strong(value: string): boolean { return value.length >= 12 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value); }
function format(value: string): string { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
function message(cause: unknown, fallback: string): string { return cause instanceof Error ? cause.message : fallback; }
