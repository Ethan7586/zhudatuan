import { expect, it } from 'vitest';
import { homeViewModel } from './HomeViewModel';
it('binds the home route', () => expect(homeViewModel.routes).toEqual(['miniapphome']));
