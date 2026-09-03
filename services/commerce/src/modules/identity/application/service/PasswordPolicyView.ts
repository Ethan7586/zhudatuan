import type { OperationOutputFor } from '@shop/contract';

type PasswordPolicy = OperationOutputFor<'identity.bootstrap.read'>['password'];

export function passwordPolicyView(policy: PasswordPolicy): PasswordPolicy {
  return Object.freeze({
    minimumLength: policy.minimumLength,
    maximumLength: policy.maximumLength,
    uppercase: policy.uppercase,
    lowercase: policy.lowercase,
    number: policy.number,
    symbol: policy.symbol,
  });
}
