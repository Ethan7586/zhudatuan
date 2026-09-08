import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('provider matrix', async ({ page }) => runConsoleJourney(page, {
  scenario: 'provider matrix', path: '/channels', assertions: ['十一扩展配置', '健康', '同步', '下单', '退款', '账单'],
  operations: ['extension.installations.read', 'channel.connections.read', 'channel.connections.test', 'channel.syncruns.read', 'channel.operations.read'],
}));
