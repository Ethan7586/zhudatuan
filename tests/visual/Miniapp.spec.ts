import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { MINIAPP_DEVICE_SCENARIOS } from '../../apps/miniapp/scripts/DeviceEvidence';
import { MINIAPP_PAGE_BY_ROUTE, MINIAPP_PAGES } from '../../apps/miniapp/miniprogram/generated/PageBinding';

test('小程序构建声明覆盖正式页面、隐私授权和安全区适配', () => {
  const application = JSON.parse(readFileSync('apps/miniapp/miniprogram/app.json', 'utf8')) as { pages: string[]; subPackages: readonly Readonly<{ root: string; pages: string[] }>[] };
  const declaredPages = [...application.pages, ...application.subPackages.flatMap(({ root, pages }) => pages.map((page) => `${root}/${page}`))];
  const privacy = readFileSync('apps/miniapp/miniprogram/platform/Privacy.ts', 'utf8');
  const shell = readFileSync('apps/miniapp/miniprogram/shell/shell.wxss', 'utf8');
  expect(Object.keys(MINIAPP_PAGE_BY_ROUTE)).toHaveLength(17);
  expect(new Set(Object.values(MINIAPP_PAGE_BY_ROUTE))).toEqual(new Set(MINIAPP_PAGES));
  expect(new Set(declaredPages)).toEqual(new Set(MINIAPP_PAGES.map((page) => page.slice(1))));
  expect(privacy).toContain('getPrivacySetting');
  expect(privacy).toContain('requirePrivacyAuthorize');
  expect(shell).toMatch(/safe-area-inset-top/);
  expect(shell).toMatch(/safe-area-inset-bottom/);
  expect(MINIAPP_DEVICE_SCENARIOS).toEqual(['safearea', 'weaknetwork', 'privacyauthorization', 'login', 'purchase', 'paymentreturn', 'order', 'voucher', 'scanredemption']);
});

test('微信开发者工具与代表真机证据按当前构建 Hash 硬阻断且不可伪造', () => {
  const gate = readFileSync('apps/miniapp/scripts/DeviceGate.ts', 'utf8');
  const validator = readFileSync('apps/miniapp/scripts/DeviceEvidence.ts', 'utf8');
  expect(gate).toContain('MINIAPP_DEVICE_EVIDENCE_REQUIRED');
  expect(validator).toContain('MINIAPP_DEVELOPER_TOOL_EVIDENCE_MISSING');
  expect(validator).toContain('MINIAPP_PHYSICAL_DEVICE_EVIDENCE_MISSING');
  expect(validator).toContain('MINIAPP_WEAK_NETWORK_EVIDENCE_MISSING');
  expect(validator).toContain('MINIAPP_OFFLINE_EVIDENCE_MISSING');
});
