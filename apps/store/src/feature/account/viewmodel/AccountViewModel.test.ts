import { expect, it } from 'vitest';
import { accountViewModel } from './AccountViewModel';
it('binds account work', () => expect(accountViewModel.routes).toEqual(['storeaccountwork']));
