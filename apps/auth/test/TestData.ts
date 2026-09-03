import { vi } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import type { AuthEnvironment } from '../src/config/Environment';
import type { Bootstrap } from '../src/feature/bootstrap/model/Bootstrap';
import type { BootstrapPort } from '../src/feature/bootstrap/public/BootstrapPort';
import type { Membership } from '../src/feature/membership/model/Membership';
import type { IdentitySdk } from '../src/shared/api/Client';

export const environment: AuthEnvironment = Object.freeze({
  apiOrigin: 'http://127.0.0.1:3001',
  consoleOrigin: 'http://127.0.0.1:4173',
  storefrontOrigin: 'http://127.0.0.1:3000',
  clientVersion: '1.0.0',
});

export const bootstrap: Bootstrap = Object.freeze({
  target: 'storefront',
  returnTarget: 'signed-return',
  expiresAt: Date.now() + 60_000,
  csrf: 'csrf-token',
  methods: Object.freeze(['password', 'otp', 'invitation', 'federation'] as const),
  preferredMethod: 'password',
  password: Object.freeze({ minimumLength: 12, maximumLength: 128, uppercase: true, lowercase: true, number: true, symbol: true }),
  otp: Object.freeze({ validSeconds: 300, resendSeconds: 60 }),
  legal: Object.freeze({ termsTitle: '服务协议', termsBody: '服务条款正文', privacyTitle: '隐私政策', privacyBody: '隐私政策正文', termsHash: 'terms-hash' }),
});

export const membership = Object.freeze({
  id: 'membership-1',
  target: 'storefront',
  displayName: '测试员工',
  organizationName: '示例企业',
  scopeKind: 'organization',
  scopeId: 'organization-1',
  roleLabel: '员工',
  logoUrl: null,
}) satisfies Membership;

export function bootstrapPort(value: Bootstrap = bootstrap): BootstrapPort {
  return Object.freeze({ read: vi.fn(async () => value), clear: vi.fn() });
}

export function identitySdk(methods: Partial<IdentitySdk>): IdentitySdk {
  return new Proxy(methods, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (value !== undefined) return value;
      return vi.fn(async () => { throw new Error(`UNEXPECTED_SDK_CALL:${String(property)}`); });
    },
  }) as IdentitySdk;
}

export function bootstrapOutput(target: 'console' | 'storefront' = 'storefront'): OperationOutputFor<'identity.bootstrap.read'> {
  return {
    target,
    returnTarget: 'signed-return',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    csrf: 'csrf-token',
    methods: ['password', 'otp', 'invitation', 'federation'],
    preferredMethod: 'password' as const,
    password: { minimumLength: 12, maximumLength: 128, uppercase: true, lowercase: true, number: true, symbol: true },
    otp: { validSeconds: 300, resendSeconds: 60 },
    legal: { terms_title: '服务协议', terms_body: '服务条款正文', privacy_title: '隐私政策', privacy_body: '隐私政策正文', terms_hash: 'terms-hash' },
  };
}
