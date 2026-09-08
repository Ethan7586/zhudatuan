import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('create mall', async ({ page }) => runConsoleJourney(page, {
  scenario: 'create mall', path: '/experience', assertions: ['Mall Scope', '默认应用', '主题', '入口创建'],
  operations: ['organization.malls.create', 'organization.malls.read', 'experience.applications.read'],
}));

test('copy application', async ({ page }) => runConsoleJourney(page, {
  scenario: 'copy application', path: '/experience', assertions: ['内容复制', '身份不复制', '发布不复制', 'Secret不复制'],
  operations: ['experience.applications.read', 'experience.applications.copy', 'experience.applications.detail.read'],
}));

test('shop theme', async ({ page }) => runConsoleJourney(page, {
  scenario: 'shop theme', path: '/experience', assertions: ['编辑', '预览', '发布', '多端展示'],
  operations: ['experience.applications.update', 'experience.versions.save', 'experience.versions.validate', 'experience.versions.publish'],
}));

test('market theme', async ({ page }) => runConsoleJourney(page, {
  scenario: 'market theme', path: '/experience', assertions: ['全链路', '复用同一组件系统'],
  operations: ['experience.applications.detail.read', 'experience.versions.validate', 'experience.versions.publish'],
}));

test('governance theme', async ({ page }) => runConsoleJourney(page, {
  scenario: 'governance theme', path: '/experience', assertions: ['全链路', '资格边界', '身份边界'],
  operations: ['experience.versions.validate', 'qualification.decisions.preview', 'experience.versions.publish'],
}));

test('publish recovery', async ({ page }) => runConsoleJourney(page, {
  scenario: 'publish recovery', path: '/experience', assertions: ['CDN失败保旧版', '重试', '回滚'],
  operations: ['experience.published.read', 'experience.versions.publish', 'experience.versions.restore'],
}));
