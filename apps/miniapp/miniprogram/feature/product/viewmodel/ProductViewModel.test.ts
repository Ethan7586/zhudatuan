import { expect, it } from 'vitest';
import { productViewModel } from './ProductViewModel';
it('binds the product route', () => expect(productViewModel.routes).toEqual(['miniappproduct']));
