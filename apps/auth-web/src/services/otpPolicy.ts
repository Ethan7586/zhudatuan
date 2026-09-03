<<<<<<< HEAD
// 用户在短信发送失败或未送达后，最多等待 30 秒即可再次请求。
export const SMS_CODE_RESEND_SECONDS = 30 as const;
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 31b27b78 (fix(auth): measure SMS cooldown by wall clock)
=======
// 用户在短信发送失败或未送达后，最多等待 45 秒即可再次请求。
export const SMS_CODE_RESEND_SECONDS = 45 as const;
>>>>>>> 664ec154 (fix(storefront): avoid repeated L6 verification)

export function smsResendDeadline(nowMs: number, requestedSeconds: number = SMS_CODE_RESEND_SECONDS): number {
  const boundedSeconds = Math.min(SMS_CODE_RESEND_SECONDS, Math.max(0, Math.ceil(requestedSeconds)));
  return nowMs + boundedSeconds * 1_000;
}

export function smsResendSecondsRemaining(deadlineMs: number, nowMs: number): number {
  return Math.min(SMS_CODE_RESEND_SECONDS, Math.max(0, Math.ceil((deadlineMs - nowMs) / 1_000)));
}
<<<<<<< HEAD
=======
>>>>>>> 4dd41dd1 (fix(auth): cap SMS resend wait at 30 seconds)
=======
>>>>>>> 31b27b78 (fix(auth): measure SMS cooldown by wall clock)
