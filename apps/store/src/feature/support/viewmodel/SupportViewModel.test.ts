import { expect, it } from 'vitest';
import { supportViewModel } from './SupportViewModel';
it('binds support list and conversation', () => expect(supportViewModel.routes).toEqual(['storesupportwork', 'storeworkcase']));
