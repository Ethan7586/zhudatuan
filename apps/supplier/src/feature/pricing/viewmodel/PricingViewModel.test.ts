import { expect, it } from 'vitest'; import { pricingViewModel } from './PricingViewModel';
it('binds pricing', () => expect(pricingViewModel.routes).toEqual(['supplierpricing']));
