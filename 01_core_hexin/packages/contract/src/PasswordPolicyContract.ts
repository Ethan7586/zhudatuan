export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_REJECTED_EXACT_VALUE = '123456';
export const PASSWORD_POLICY_MESSAGE = '密码须为 6–128 位，不得包含空格，且不能使用 123456';
export const PASSWORD_POLICY_HINT = '至少 6 位，不含空格，不能使用 123456';

export function passwordMeetsPolicy(value: string): boolean {
  return value.length >= PASSWORD_MIN_LENGTH
    && value.length <= PASSWORD_MAX_LENGTH
    && !/\s/u.test(value)
    && value !== PASSWORD_REJECTED_EXACT_VALUE;
}
