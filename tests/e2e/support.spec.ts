import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('conversation', async ({ page }) => runConsoleJourney(page, {
  scenario: 'conversation', path: '/support', assertions: ['发起', '分配', '实时消息', '附件', '关闭或重开', 'SLA'],
  operations: ['support.cases.read', 'support.cases.create', 'support.messages.read', 'support.messages.send', 'support.attachments.create', 'support.cases.close', 'support.cases.reopen'],
}));
