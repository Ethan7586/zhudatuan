import { expect, it } from 'vitest';
import { supportViewModel } from './SupportViewModel';
it('binds support', () => expect(supportViewModel.routes).toEqual(['storesupportwork']));
