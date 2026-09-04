import { expect, it } from 'vitest';
import { dashboardViewModel } from './DashboardViewModel';
it('binds today tasks', () => expect(dashboardViewModel.routes).toEqual(['storetasks']));
