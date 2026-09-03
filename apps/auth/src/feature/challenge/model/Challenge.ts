export type ChallengeRequest =
  | Readonly<{ purpose: 'login' | 'password_reset'; destination: string }>
  | Readonly<{ purpose: 'enrollment'; enrollmentId: string }>
  | Readonly<{ purpose: 'enrollment_campaign'; enrollmentId: string; destination: string }>;

export interface Challenge {
  readonly id: string;
  readonly expiresAt: string;
  readonly retryAt: string;
  readonly validSeconds: number;
  readonly resendSeconds: number;
}

export function challengeNotice(validSeconds: number, resendSeconds: number, protectExistence = false): string {
  const timing = `验证码发送请求已提交，验证码 ${Math.max(1, Math.ceil(validSeconds / 60))} 分钟内有效；${Math.max(0, resendSeconds)} 秒后可重新获取。`;
  return protectExistence ? `${timing}为保护账号存在性，无论账号是否存在均显示相同结果。` : timing;
}
