import { expect, it } from 'vitest';
import { aftersaleViewModel } from './AftersaleViewModel';
it('binds the aftersale route', () => expect(aftersaleViewModel.routes).toEqual(['miniappaftersale']));
