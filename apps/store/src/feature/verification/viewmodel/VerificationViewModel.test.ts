import { expect, it } from 'vitest';
import { verificationViewModel } from './VerificationViewModel';
it('binds verification', () => expect(verificationViewModel.routes).toEqual(['storeverification']));
