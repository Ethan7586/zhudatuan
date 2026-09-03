import { useEffect, useRef, useState } from 'react';
import type { Challenge, ChallengeRequest } from '../../challenge/model/Challenge';
import { challengeNotice } from '../../challenge/model/Challenge';
import { useCooldown } from '../../challenge/viewmodel/ChallengeViewModel';
import type { EnrollmentCompletion, EnrollmentState } from '../model/Enrollment';
import { clearSecretInput, Secret } from '../../../shared/security/Secret';
import type { ActionResult } from '../../../shared/ui/ActionResult';
import type { PasswordPolicy } from '../../bootstrap/model/Bootstrap';

interface EnrollmentForm { readonly displayName: string; readonly mobile: string; readonly code: string }

export function useEnrollmentViewModel(enrollment: EnrollmentState, passwordPolicy: PasswordPolicy, createChallenge: (request: ChallengeRequest) => Promise<ActionResult<Challenge>>, onComplete: (input: EnrollmentCompletion) => Promise<ActionResult<void>>, onClose: () => void) {
  const bound = enrollment.subjectMode === 'bound';
  const [form, setForm] = useState<EnrollmentForm>(() => initial(enrollment));
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
  const update = (key: keyof EnrollmentForm, value: string) => { setForm((current) => ({ ...current, [key]: value })); if (key === 'mobile') { setChallenge(''); setChallengeSubject(''); cooldown.clear(); } setError(''); };
  const send = async () => {
    if (!bound && !/^\+?\d{8,20}$/.test(form.mobile.trim())) return setError('请输入有效手机号。');
    setBusy('code'); setError('');
    try {
      const request: ChallengeRequest = bound ? { purpose: 'enrollment', enrollmentId: enrollment.id } : { purpose: 'enrollment_campaign', enrollmentId: enrollment.id, destination: form.mobile.trim() };
      const result = await createChallenge(request); if (!result.ok) return setError(result.failure.message);
      setChallenge(result.value.id); setChallengeSubject(bound ? enrollment.id : form.mobile.trim()); update('code', ''); cooldown.start(result.value.resendSeconds); setNotice(challengeNotice(result.value.validSeconds, result.value.resendSeconds));
    } finally { setBusy(undefined); }
  };
  const clearPasswords = (message: string) => { clearSecretInput(passwordInput.current, password); clearSecretInput(confirmInput.current, confirm); setError(message); };
  const submit = async () => {
    const subject = bound ? enrollment.id : form.mobile.trim();
    if (!challenge || challengeSubject !== subject) return setError('请先为当前邀请获取验证码。');
    if (!/^\d{6}$/.test(form.code)) return setError('请输入 6 位短信验证码。');
    if (form.displayName.trim().length < 2) return setError('请输入真实姓名。');
    if (!accepted) return setError('请先阅读并同意服务协议与隐私政策。');
    const passwordValue = password.take(); const confirmValue = confirm.take();
    if (!strong(passwordValue, passwordPolicy)) return clearPasswords('新密码不符合当前安全要求，请按输入提示修改。');
    if (passwordValue !== confirmValue) return clearPasswords('两次输入的密码不一致。');
    setBusy('submit'); setError('');
    try { const result = await onComplete({ id: enrollment.id, subjectMode: enrollment.subjectMode, ...(!bound ? { subject: form.mobile.trim() } : {}), challenge, code: form.code, password: passwordValue, displayName: form.displayName.trim(), termsHash: enrollment.policy.termsHash }); if (!result.ok) return setError(result.failure.message); setForm(initial(enrollment)); setAccepted(false); setChallenge(''); }
    finally { setBusy(undefined); clearSecretInput(passwordInput.current, password); clearSecretInput(confirmInput.current, confirm); }
  };
  const close = () => { if (busy) return; setForm(initial(enrollment)); setChallenge(''); setChallengeSubject(''); setAccepted(false); setPolicy(undefined); setNotice(''); setError(''); cooldown.clear(); clearSecretInput(passwordInput.current, password); clearSecretInput(confirmInput.current, confirm); onClose(); };
  return Object.freeze({ enrollment, passwordPolicy, bound, form, challenge, accepted, policy, busy, notice, error, seconds: cooldown.seconds, first, passwordInput, confirmInput, update, setAccepted, setPolicy, setPassword: (value: string) => password.set(value), setConfirm: (value: string) => confirm.set(value), send, submit, close });
}

export type EnrollmentViewModel = ReturnType<typeof useEnrollmentViewModel>;
function initial(enrollment: EnrollmentState): EnrollmentForm { return { displayName: enrollment.employee?.displayName ?? '', mobile: '', code: '' }; }
function strong(value: string, policy: PasswordPolicy): boolean { return value.length >= policy.minimumLength && value.length <= policy.maximumLength && (!policy.lowercase || /[a-z]/.test(value)) && (!policy.uppercase || /[A-Z]/.test(value)) && (!policy.number || /\d/.test(value)) && (!policy.symbol || /[^A-Za-z0-9]/.test(value)); }
