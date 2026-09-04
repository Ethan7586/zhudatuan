import { credentialSecret, voucherCredential, voucherNumber } from '@shop/contract/voucher';

export type Activation = Readonly<{ mode: 'numbersecret'; number: string; secret: string }> | Readonly<{ mode: 'secret'; secret: string }>;
export interface ActivationDraft { readonly mode: Activation['mode']; readonly number: string; readonly secret: string; readonly key: string; }

export function activationError(draft: ActivationDraft): string | null {
  if (draft.mode === 'numbersecret' && voucherNumber(draft.number) === null) return `请填写卡面上的完整卡号（${voucherCredential.number.minimum}–${voucherCredential.number.maximum} 位字母或数字）。`;
  if (credentialSecret(draft.secret) === null) return `请核对券密（${voucherCredential.secret.minimum}–${voucherCredential.secret.maximum} 个字符），使用卡面上的字母、数字或符号，注意区分大小写。`;
  return null;
}
