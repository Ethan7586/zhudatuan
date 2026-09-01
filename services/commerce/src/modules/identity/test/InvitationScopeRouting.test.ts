import { describe, expect, it } from 'vitest';
import { EnrollmentsCompleteHandler } from '../application/handler/EnrollmentsCompleteHandler';
import { SessionsCompleteHandler } from '../application/handler/SessionsCompleteHandler';
import { SessionsCreateHandler } from '../application/handler/SessionsCreateHandler';

describe('invitation transaction scope routing', () => {
  it('routes only invitation session creation to the verified invitation organization', () => {
    const handler = new SessionsCreateHandler({} as never, {} as never, {} as never);
    expect(
      handler.transactionScope(
        {} as never,
        {
          kind: 'invitation',
          request: {} as never,
          preparation: { loaded: { invitation: { state: { organization: 'mall-zhudatuan' } } } },
        } as never
      )
    ).toBe('mall-zhudatuan');
    expect(handler.transactionScope({} as never, { kind: 'authentication', request: {} } as never)).toBeUndefined();
  });

  it('routes invitation proof completion from its loaded claim instead of request input', () => {
    const handler = new SessionsCompleteHandler({} as never);
    expect(handler.transactionScope({ path: { id: 'attacker-supplied' } } as never, { preparation: { invitation: 'invitation:one', scope: 'mall-zhudatuan' } } as never)).toBe('mall-zhudatuan');
  });

  it('routes enrollment completion from its loaded claim instead of request input', () => {
    const handler = new EnrollmentsCompleteHandler({} as never);
    expect(handler.transactionScope({ path: { id: 'attacker-supplied' } } as never, { preparation: { invitation: 'invitation:one', scope: 'mall-zhudatuan' } } as never)).toBe('mall-zhudatuan');
  });
});
