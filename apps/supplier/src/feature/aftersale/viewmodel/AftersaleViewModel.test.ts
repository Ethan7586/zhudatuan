import { expect, it } from 'vitest'; import { aftersaleViewModel } from './AftersaleViewModel';
it('binds returns', () => expect(aftersaleViewModel.routes).toEqual(['supplierreturns']));
