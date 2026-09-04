import { expect, it } from 'vitest';
import { accountViewModel } from './AccountViewModel';
it('binds profile and security routes', () => expect(accountViewModel.routes).toEqual(['miniappprofile', 'miniappsecurity']));
