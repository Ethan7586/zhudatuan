import { Button, Dialog, Form } from '@shop/design';
import { useEffect, useRef, useState } from 'react';
import type { Challenge, ChallengeRequest } from '../../challenge/model/Challenge';
import { challengeNotice } from '../../challenge/model/Challenge';
import { useCooldown } from '../../challenge/ui/useCooldown';
import type { EnrollmentCompletion, EnrollmentState } from '../model/Enrollment';
import { canEditDisplayName } from '../model/RegistrationPolicy';
import { InvitationError } from './InvitationError';
import { MobileProof } from './MobileProof';
import { PasswordSetup } from './PasswordSetup';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';
import type { ActionResult } from '../../../shared/ui/ActionResult';
import type { PasswordPolicy } from '../../bootstrap/model/Bootstrap';
import { PolicyDialog } from '../../../shared/ui/PolicyDialog';

interface EnrollmentFormState {
  readonly displayName: string;
  readonly mobile: string;
  readonly code: string;
}

export function EnrollmentPage({ enrollment, passwordPolicy, createChallenge, onComplete, onClose }: Readonly<{
  enrollment: EnrollmentState;
  passwordPolicy: PasswordPolicy;
  createChallenge: (request: ChallengeRequest) => Promise<ActionResult<Challenge>>;
  onComplete: (input: EnrollmentCompletion) => Promise<ActionResult<void>>;
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
  const passwordInput = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const password = useRef(new Secret()).current;
  const confirm = useRef(new Secret()).current;
  const cooldown = useCooldown();
  useEffect(() => { first.current?.focus(); return () => { clearSecretInput(passwordInput.current, password); clearSecretInput(confirmInput.current, confirm); }; }, [confirm, password]);
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
      if (!result.ok) return setError(result.failure.message);
      setChallenge(result.value.id);
      setChallengeSubject(bound ? enrollment.id : form.mobile.trim());
      update('code', '');
      cooldown.start(result.value.resendSeconds);
      setNotice(challengeNotice(result.value.validSeconds, result.value.resendSeconds));
    } finally {
      setBusy(undefined);
    }
  };
  const clearPasswords = (message: string) => {
    clearSecretInput(passwordInput.current, password);
    clearSecretInput(confirmInput.current, confirm);
    setError(message);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const subject = bound ? enrollment.id : form.mobile.trim();
    if (!challenge || challengeSubject !== subject) return setError('请先为当前邀请获取验证码。');
    if (!/^\d{6}$/.test(form.code)) return setError('请输入 6 位短信验证码。');
    if (form.displayName.trim().length < 2) return setError('请输入真实姓名。');
    if (!accepted) return setError('请先阅读并同意服务协议与隐私政策。');
    const passwordValue = password.take();
    const confirmValue = confirm.take();
    if (!strong(passwordValue, passwordPolicy)) return clearPasswords('新密码不符合当前安全要求，请按输入提示修改。');
    if (passwordValue !== confirmValue) return clearPasswords('两次输入的密码不一致。');
    setBusy('submit');
    setError('');
    try {
      const result = await onComplete({
        id: enrollment.id,
        subjectMode: enrollment.subjectMode,
        ...(!bound ? { subject: form.mobile.trim() } : {}),
        challenge,
        code: form.code,
        password: passwordValue,
        displayName: form.displayName.trim(),
        termsHash: enrollment.policy.termsHash,
      });
      if (!result.ok) return setError(result.failure.message);
      setForm(initial(enrollment));
      setAccepted(false);
      setChallenge('');
    } finally {
      setBusy(undefined);
      clearSecretInput(passwordInput.current, password);
      clearSecretInput(confirmInput.current, confirm);
    }
  };
  const close = () => {
    if (busy) return;
    setForm(initial(enrollment));
    setChallenge('');
    setChallengeSubject('');
    setAccepted(false);
    setPolicy(undefined);
    setNotice('');
    setError('');
    cooldown.clear();
    clearSecretInput(passwordInput.current, password);
    clearSecretInput(confirmInput.current, confirm);
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
          <PasswordSetup policy={passwordPolicy} passwordRef={passwordInput} confirmRef={confirmInput} busy={busy !== undefined} onPassword={(value) => password.set(value)} onConfirm={(value) => confirm.set(value)} />
          <label className="enrollmentagreement"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={busy !== undefined} /><span>我已阅读并同意 <button type="button" onClick={() => setPolicy('terms')}>《{enrollment.policy.termsTitle}》</button>和<button type="button" onClick={() => setPolicy('privacy')}>《{enrollment.policy.privacyTitle}》</button></span></label>
          <Button type="submit" tone="primary" isDisabled={busy !== undefined || challenge === '' || !accepted}>{busy === 'submit' ? '正在创建账号…' : '创建普通员工账号'}</Button>
          <p className="enrollmenthint">密码和验证码不会写入浏览器长期存储。注册仅开通员工商城，控制台权限需另行授权。</p>
        </Form>
      </Dialog>
      <PolicyDialog policy={enrollment.policy} {...(policy === undefined ? {} : { kind: policy })} onClose={() => setPolicy(undefined)} onAccept={() => { setAccepted(true); setPolicy(undefined); }} />
    </>
  );
}

function initial(enrollment: EnrollmentState): EnrollmentFormState { return { displayName: enrollment.employee?.displayName ?? '', mobile: '', code: '' }; }
function strong(value: string, policy: PasswordPolicy): boolean { return value.length >= policy.minimumLength && value.length <= policy.maximumLength && (!policy.lowercase || /[a-z]/.test(value)) && (!policy.uppercase || /[A-Z]/.test(value)) && (!policy.number || /\d/.test(value)) && (!policy.symbol || /[^A-Za-z0-9]/.test(value)); }
function format(value: string): string { return new Date(value).toLocaleString('zh-CN', { hour12: false }); }
