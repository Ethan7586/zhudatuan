import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdentityClient } from './IdentityClient';

const TARGET_PROOF = 'proof.'.concat('a'.repeat(64));
const STRING_MATCHER = expect.any(String) as unknown;

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('IdentityClient', () => {
  it('uses the generated discriminated password contract and exchanges a one-time ticket', async () => {
    const { fetcher, requests } = fetchSequence(
      json({ items: [], csrf: 'c'.repeat(43), target: 'storefront', returnTarget: TARGET_PROOF }),
      json({ kind: 'session', ticket: 't'.repeat(64), returnTarget: TARGET_PROOF }, 201),
      json({ returnTarget: { url: 'http://127.0.0.1:3000/', proof: TARGET_PROOF, expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' }, expiresIn: 3600 })
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(new IdentityClient().password('  member  ', '  password  ', 'storefront')).resolves.toEqual({
      kind: 'authenticated',
      redirectUrl: 'http://127.0.0.1:3000/',
    });
    const body = parsedBody(requests[1]) as Readonly<{ authorization: Readonly<{ state: string }> }>;
    expect(body).toMatchObject({ method: 'password', subject: 'member', password: '  password  ', target: 'storefront', authorization: { state: STRING_MATCHER, nonce: STRING_MATCHER, challenge: STRING_MATCHER } });
    expect(body).not.toHaveProperty('provider');
    expect(body).not.toHaveProperty('membership');
    expect(requests[1]?.headers.get('x-csrf-token')).toBe('c'.repeat(43));
    expect(parsedBody(requests[2])).toMatchObject({ ticket: 't'.repeat(64), state: body.authorization.state });
  });

  it('submits an invitation only in the request body and continues enrollment by opaque preauth id', async () => {
    const { fetcher, requests } = fetchSequence(
      json({ items: [], csrf: 'c'.repeat(43), target: 'storefront', returnTarget: TARGET_PROOF }),
      json({ kind: 'enrollment', enrollment: { id: 'claim:one', expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' } }, 202),
      json({
        id: 'claim:one',
        target: 'storefront',
        expiresAt: '2099-01-01T00:00:00.000Z',
        policy: {
          terms_title: '服务协议',
          terms_body: '正文',
          privacy_title: '隐私政策',
          privacy_body: '正文',
          terms_hash: 'a'.repeat(64),
        },
      })
    );
    vi.stubGlobal('fetch', fetcher);
    const client = new IdentityClient();

    await expect(client.invitation('invitation-secret', 'storefront')).resolves.toMatchObject({ kind: 'enrollment', id: 'claim:one' });
    expect(requests[1]?.url).not.toContain('invitation-secret');
    expect(parsedBody(requests[1])).toMatchObject({ method: 'invitation', code: 'invitation-secret', target: 'storefront' });
    await expect(client.enrollment('claim:one')).resolves.toMatchObject({ id: 'claim:one', policy: { termsHash: 'a'.repeat(64) } });
    expect(requests[2]?.url).toContain('/api/v1/identity/enrollments/claim%3Aone');
    expect(requests[2]?.url).not.toContain('invitation-secret');
  });

  it('consumes the HttpOnly preauth selection through the generated 303 contract', async () => {
    const { fetcher, requests } = fetchSequence(
      json({ items: [], csrf: 'c'.repeat(43), target: 'storefront', returnTarget: TARGET_PROOF }),
      json({
        kind: 'selection',
        transaction: 'selection-one',
        memberships: [
          { id: 'membership-one', target: 'storefront' },
          { id: 'membership-two', target: 'storefront' },
        ],
      }),
      redirect('http://127.0.0.1:3000/')
    );
    vi.stubGlobal('fetch', fetcher);
    const client = new IdentityClient();

    await expect(client.password('member', 'password', 'storefront')).resolves.toMatchObject({ kind: 'selection', transaction: 'selection-one' });
    await expect(client.selectMembership('membership-two', 'storefront')).resolves.toEqual({
      kind: 'authenticated',
      redirectUrl: 'http://127.0.0.1:3000/',
    });
    expect(parsedBody(requests[2])).toEqual({ membershipid: 'membership-two' });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('reads an external federation selection and rejects a repeated server-side consumption', async () => {
    const { fetcher } = fetchSequence(
      json({ memberships: [{ id: 'membership-one', target: 'storefront' }], expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' }),
      json({ items: [], csrf: 'c'.repeat(43), target: 'storefront', returnTarget: TARGET_PROOF }),
      redirect('http://127.0.0.1:3000/'),
      json({ code: 'MEMBERSHIP_SELECTION_REQUIRED', message: '身份选择不可用', requestId: 'request-one', retryable: false }, 409)
    );
    vi.stubGlobal('fetch', fetcher);
    const client = new IdentityClient();

    await expect(client.membershipSelection('storefront')).resolves.toEqual({ memberships: [{ id: 'membership-one', target: 'storefront' }], expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' });
    await expect(client.selectMembership('membership-one', 'storefront')).resolves.toMatchObject({ kind: 'authenticated' });
    await expect(client.selectMembership('membership-one', 'storefront')).rejects.toThrow('身份选择不可用');
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it('starts federation through the dedicated generated redirect operation', async () => {
    const provider = '11111111-1111-4111-8111-111111111111';
    const { fetcher, requests } = fetchSequence(json({ items: [{ id: provider, type: 'oidc', status: 'enabled' }], csrf: 'c'.repeat(43), target: 'console', returnTarget: TARGET_PROOF }), redirect('https://identity.example.com/authorize'));
    vi.stubGlobal('fetch', fetcher);

    await expect(new IdentityClient().provider(provider, 'console')).resolves.toMatchObject({ kind: 'proofRequired', method: 'sso', target: 'console', reference: 'https://identity.example.com/authorize' });
    expect(requests[1]?.url).toContain('/api/v1/identity/federations');
    expect(parsedBody(requests[1])).toMatchObject({ providerid: provider, returntarget: TARGET_PROOF, authorization: { state: STRING_MATCHER, nonce: STRING_MATCHER, challenge: STRING_MATCHER } });
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { location } });
}

interface CapturedRequest {
  readonly url: string;
  readonly body: BodyInit | null | undefined;
  readonly headers: Headers;
}
function fetchSequence(...responses: Response[]) {
  const requests: CapturedRequest[] = [];
  let index = 0;
  const implementation = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    requests.push({ url: requestUrl(input), body: init?.body, headers: new Headers(init?.headers) });
    const response = responses[index++];
    return response === undefined ? Promise.reject(new Error('UNEXPECTED_FETCH')) : Promise.resolve(response);
  };
  return { fetcher: vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(implementation), requests };
}
function requestUrl(input: RequestInfo | URL): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
}
function parsedBody(request: CapturedRequest | undefined): unknown {
  if (typeof request?.body !== 'string') throw new Error('REQUEST_BODY_MISSING');
  return JSON.parse(request.body) as unknown;
}
