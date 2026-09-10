import { expect, it } from 'vitest';
import { accountViewModel } from './AccountViewModel';
it('binds account', () => expect(accountViewModel.routes).toEqual(['supplieraccount']));
