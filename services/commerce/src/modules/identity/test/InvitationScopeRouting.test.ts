import { describe, expect, it } from 'vitest';
import { EnrollmentsCompleteHandler } from '../application/handler/EnrollmentsCompleteHandler';
import { SessionsCompleteHandler } from '../application/handler/SessionsCompleteHandler';
import { InvitationsResolveHandler } from '../application/handler/InvitationsResolveHandler';

describe('invitation transaction scope routing', () => {
  it('routes invitation resolution to the organization loaded from the invitation', () => {
    const handler = new InvitationsResolveHandler({} as never);
    expect(
      handler.transactionScope(
        {} as never,
        {
          request: {} as never,
          resolution: { loaded: { invitation: { state: { organization: 'mall-zhudatuan' } } } },
        } as never
      )
    ).toBe('mall-zhudatuan');
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
