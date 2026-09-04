import { expect, it } from 'vitest';
import { supportViewModel } from './SupportViewModel';
it('binds support list and detail routes', () => expect(supportViewModel.routes).toEqual(['miniappsupport', 'miniappsupportcase']));
