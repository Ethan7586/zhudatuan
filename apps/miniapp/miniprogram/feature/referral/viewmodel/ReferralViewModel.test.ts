import { expect, it } from 'vitest';
import { referralViewModel } from './ReferralViewModel';
it('binds the referral route', () => expect(referralViewModel.routes).toEqual(['miniappreferral']));
