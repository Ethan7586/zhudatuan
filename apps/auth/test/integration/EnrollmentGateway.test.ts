// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { IdentitySdk } from '../../src/shared/api/Client';
import { CompleteEnrollment } from '../../src/feature/enrollment/application/CompleteEnrollment';
import { EnrollmentGateway } from '../../src/feature/enrollment/infrastructure/EnrollmentGateway';
import { AuthorizationJourney } from '../../src/shared/security/AuthorizationJourney';
import { createAuthorization } from '../../src/shared/security/Authorization';
import { bootstrapPort, environment, expectCommandContext, expectQueryContext, identitySdk } from '../TestData';

describe('EnrollmentGateway', () => {
  it('reads the one-time enrollment through its generated operation', async () => {
    const read = vi.fn<IdentitySdk['enrollmentsRead']>(async () => ({
      id: 'enrollment-1',
      kind: 'enrollment',
      target: 'storefront',
      expiresAt: '2099-01-01T00:00:00.000Z',
      subjectMode: 'bound',
      organization: { id: 'organization-1', name: '示例企业' },
      recipientMasked: '138****0000',
      employee: { displayName: '测试员工', employeeNo: 'E001' },
      policy: { terms_title: '服务协议', terms_body: '条款', privacy_title: '隐私政策', privacy_body: '隐私', terms_hash: 'hash' },
    }));
    const gateway = new EnrollmentGateway(identitySdk({ enrollmentsRead: read }), environment, bootstrapPort(), new AuthorizationJourney());
    await expect(gateway.read('enrollment-1', { target: 'storefront' })).resolves.toMatchObject({ id: 'enrollment-1', employee: { employeeNo: 'E001' } });
    expect(read.mock.calls[0]?.[0]).toEqual({ path: { id: 'enrollment-1' } });
    expectQueryContext(read.mock.calls[0]?.[1]);
  });

  it('singleflights duplicate completion and never carries an administrator-created password', async () => {
    let release: (() => void) | undefined;
    const complete = vi.fn<IdentitySdk['enrollmentsComplete']>(() => new Promise<{ kind: 'enrolled'; target: 'storefront' }>((resolve) => { release = () => resolve({ kind: 'enrolled', target: 'storefront' }); }));
    const journey = new AuthorizationJourney();
    const authorization = await createAuthorization();
    journey.remember('enrollment-1', '2099-01-01T00:00:00.000Z', authorization);
    const gateway = new EnrollmentGateway(identitySdk({ enrollmentsComplete: complete }), environment, bootstrapPort(), journey);
    const usecase = new CompleteEnrollment(gateway);
    const input = { id: 'enrollment-1', subjectMode: 'bound' as const, challenge: 'challenge-1', code: '123456', termsHash: 'hash', password: 'Secret-12345!' };
    const session = Object.freeze({ target: 'storefront' as const, returnPath: '/welcome' });
    const first = usecase.execute(input, session);
    const second = usecase.execute(input, session);
    expect(first).toBe(second);
    await vi.waitFor(() => expect(complete).toHaveBeenCalledOnce());
    expect(complete.mock.calls[0]?.[0].body).toMatchObject({ mode: 'bound', password: 'Secret-12345!', termsAccepted: true });
    expect(complete.mock.calls[0]?.[0].body.authorization).toEqual(authorization.request);
    expect(complete.mock.calls[0]?.[0].body).not.toHaveProperty('initialPassword');
    expectCommandContext(complete.mock.calls[0]?.[1]);
    release?.();
    await first;
    expect(() => journey.require('enrollment-1')).toThrow('SESSION_CONTEXT_MISSING');
  });
});
