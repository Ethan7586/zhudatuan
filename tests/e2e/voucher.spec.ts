import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('credential generation', async ({ page }) => runConsoleJourney(page, {
  scenario: 'credential generation', path: '/vouchers', assertions: ['百万级分片', 'Secret', 'Hash', '断点', '吞吐'],
  operations: ['voucher.credentialpools.create', 'voucher.credentials.generate', 'voucher.jobs.get'],
}));

test('credential import export', async ({ page }) => runConsoleJourney(page, {
  scenario: 'credential import export', path: '/vouchers', assertions: ['加密导入', '重复', '双人审批', '一次性下载'],
  operations: ['voucher.credentials.import', 'voucher.credentialexports.create', 'voucher.exports.get'],
}));

test('stock request', async ({ page }) => runConsoleJourney(page, {
  scenario: 'stock request', path: '/vouchers', assertions: ['草稿', '提交', '审批', '取消', '库存'],
  operations: ['voucher.stockrequests.create', 'voucher.stockrequests.update', 'voucher.stockrequests.submit', 'voucher.stockrequests.cancel'],
}));

test('issue order', async ({ page }) => runConsoleJourney(page, {
  scenario: 'issue order', path: '/vouchers', assertions: ['客户', '审批', '分批发放', '失败重试'],
  operations: ['partner.customers.list', 'voucher.issueorders.create', 'voucher.issueorders.submit', 'voucher.issuebatches.retry'],
}));

test('lifecycle', async ({ page }) => runConsoleJourney(page, {
  scenario: 'lifecycle', path: '/vouchers', assertions: ['激活', '绑定', '解绑', '停用', '恢复', '延期', '作废'],
  operations: ['voucher.activations.secret', 'voucher.vouchers.bind', 'voucher.vouchers.unbind', 'voucher.actionbatches.create'],
}));

test('redemption refund', async ({ page }) => runConsoleJourney(page, {
  scenario: 'redemption refund', path: '/vouchers', assertions: ['Quote', 'Hold', '并发核销', '部分退款', '时间线'],
  operations: ['voucher.redemptions.quote', 'voucher.tenderholds.create', 'voucher.redemptions.create', 'voucher.refunds.create', 'voucher.vouchers.timeline'],
}));
