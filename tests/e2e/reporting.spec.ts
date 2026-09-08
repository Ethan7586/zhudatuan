import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('scoped report export', async ({ page }) => runConsoleJourney(page, {
  scenario: 'scoped report export', path: '/reporting', assertions: ['集团和商城口径', 'Watermark', '快照', '导出一致'],
  operations: ['reporting.dashboard.read', 'reporting.sales.read', 'reporting.exports.create', 'reporting.exports.read'],
}));
