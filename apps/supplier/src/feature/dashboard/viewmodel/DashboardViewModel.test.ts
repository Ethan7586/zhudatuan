import { expect, it } from 'vitest';
import { dashboardViewModel } from './DashboardViewModel';
it('binds tasks', () => expect(dashboardViewModel.routes).toEqual(['suppliertasks']));
