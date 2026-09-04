import { expect, it } from 'vitest';
import { benefitViewModel } from './BenefitViewModel';
it('binds the benefit route', () => expect(benefitViewModel.routes).toEqual(['miniappbenefits']));
