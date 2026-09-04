import { describe, expect, it } from 'vitest';
import { invitationTargets } from './InvitationTarget';

describe('invitation targets', () => {
  it('keeps a mall scope fixed to the current mall', () => {
    expect(invitationTargets({ id: 'mall:one', kind: 'mall', name: '一号商城' }, [])).toEqual([{ id: 'mall:one', name: '一号商城' }]);
  });

  it('returns only malls governed by the current enterprise', () => {
    const enterprise = { id: 'enterprise:one', kind: 'enterprise', name: '一号企业' };
    expect(
      invitationTargets(enterprise, [
        { id: 'enterprise:two', kind: 'enterprise', parent_id: 'platform' },
        { id: 'mall:two', kind: 'mall', name: '二号商城', parent_id: 'enterprise:two' },
        { id: 'mall:one', kind: 'mall', name: '一号商城', parent_id: enterprise.id },
      ])
    ).toEqual([{ id: 'mall:one', name: '一号商城' }]);
  });

  it('fails closed when organization ancestry is unavailable', () => {
    expect(invitationTargets({ id: 'enterprise:one', kind: 'enterprise' }, [{ id: 'mall:one', kind: 'mall' }])).toEqual([]);
  });
});
