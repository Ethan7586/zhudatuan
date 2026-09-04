export type ChallengeRequest =
  | Readonly<{ purpose: 'login' | 'password_reset'; destination: string }>
  | Readonly<{ purpose: 'enrollment'; enrollmentId: string }>
  | Readonly<{ purpose: 'enrollment_campaign'; enrollmentId: string; destination: string }>;

export type ChallengePurpose = ChallengeRequest['purpose'] | 'invitation_login';

export interface Challenge {
  readonly id: string;
  readonly purpose: ChallengePurpose;
  readonly expiresAt: string;
  readonly retryAt: string;
  readonly attemptsRemaining: number;
  readonly validSeconds: number;
  readonly resendSeconds: number;
}

const PURPOSE_LABELS: Readonly<Record<ChallengePurpose, string>> = Object.freeze({
  login: '登录验证',
  password_reset: '重置密码',
  enrollment: '激活员工账号',
  enrollment_campaign: '注册员工账号',
  invitation_login: '确认受邀成员身份',
});

export function challengePurposeLabel(purpose: Challenge['purpose']): string {
  return PURPOSE_LABELS[purpose];
}

export function challengeNotice(challenge: Challenge, protectExistence = false): string {
  const timing = `${challengePurposeLabel(challenge.purpose)}验证码发送请求已提交。`;
  return protectExistence ? `${timing}为保护账号存在性，无论账号是否存在均显示相同结果。` : timing;
}

export function challengeState(
  value: Readonly<{ id: string; purpose: ChallengePurpose; expiresAt: string; retryAt: string; attemptsRemaining: number }>,
  expectedPurpose: ChallengePurpose,
  now = Date.now()
): Challenge | undefined {
  const expiresAt = Date.parse(value.expiresAt);
  const retryAt = Date.parse(value.retryAt);
  if (value.purpose !== expectedPurpose || !Number.isFinite(expiresAt) || !Number.isFinite(retryAt) || expiresAt <= retryAt || !Number.isSafeInteger(value.attemptsRemaining) || value.attemptsRemaining < 1) return undefined;
  return Object.freeze({
    ...value,
    validSeconds: Math.max(1, Math.ceil((expiresAt - now) / 1_000)),
    resendSeconds: Math.max(0, Math.ceil((retryAt - now) / 1_000)),
  });
}
