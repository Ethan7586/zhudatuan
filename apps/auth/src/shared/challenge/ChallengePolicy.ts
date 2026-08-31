import { RUNTIME_LIMITS } from '@shop/config/runtime';

export const OTP_POLICY = RUNTIME_LIMITS.authentication.otp;

export function challengeNotice(protectExistence = false): string {
  const timing = `验证码发送请求已提交，验证码 ${OTP_POLICY.validMinutes} 分钟内有效；${OTP_POLICY.resendSeconds} 秒后可重新获取。`;
  return protectExistence ? `${timing}为保护账号存在性，无论账号是否存在均显示相同结果。` : timing;
}
