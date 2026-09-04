import { expect, it } from 'vitest';
import { returnViewModel } from './ReturnViewModel';
it('binds returns', () => expect(returnViewModel.routes).toEqual(['storereturnwork']));
