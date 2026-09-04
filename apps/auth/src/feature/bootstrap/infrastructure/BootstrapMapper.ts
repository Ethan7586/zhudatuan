import type { OperationOutputFor } from '@shop/contract';
import { TransportError } from '@shop/sdk';
import type { Bootstrap } from '../model/Bootstrap';

export function mapBootstrap(value: OperationOutputFor<'identity.bootstrap.read'>): Bootstrap {
  const expiresAt = Date.parse(value.expiresAt);
  if (!Number.isFinite(expiresAt)) throw new TransportError('CONTRACT_INVALID', undefined, false);
  if (!value.methods.includes(value.preferredMethod)) throw new TransportError('CONTRACT_INVALID', undefined, false);
  return Object.freeze({
    target: value.target,
    returnTarget: value.returnTarget,
    expiresAt,
    csrf: value.csrf,
    methods: Object.freeze([...value.methods]),
    preferredMethod: value.preferredMethod,
    password: Object.freeze(value.password),
    otp: Object.freeze(value.otp),
    legal: Object.freeze({
      termsTitle: value.legal.terms_title,
      termsBody: value.legal.terms_body,
      privacyTitle: value.legal.privacy_title,
      privacyBody: value.legal.privacy_body,
      termsHash: value.legal.terms_hash,
    }),
  });
}
