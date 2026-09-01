import type { RegistrationPolicyRecord } from '../port/RegistrationPolicyRepository';

export function registrationPolicyView(policy: RegistrationPolicyRecord) {
  return Object.freeze({
    terms_title: policy.terms_title,
    terms_body: policy.terms_body,
    privacy_title: policy.privacy_title,
    privacy_body: policy.privacy_body,
    terms_hash: policy.terms_hash,
  });
}
