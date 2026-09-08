import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('create member', async ({ page }) => runConsoleJourney(page, {
  scenario: 'create member', path: '/settings/members', assertions: ['创建成员', '一次性 Enrollment', '首次登录'],
  operations: ['identity.members.manage', 'identity.invitations.create', 'identity.enrollments.read'],
}));

test('member import', async ({ page }) => runConsoleJourney(page, {
  scenario: 'member import', path: '/settings/members', assertions: ['上传', '预检', '提交', '部分失败', '重试', '回读'],
  operations: ['runtime.uploads.create', 'member.imports.create', 'member.imports.read', 'runtime.imports.retry'],
}));

test('role grant deny', async ({ page }) => runConsoleJourney(page, {
  scenario: 'role grant deny', path: '/settings/access', assertions: ['角色草稿', '冲突', '预览', '执行', '权限生效'],
  operations: ['access.center.read', 'access.roles.manage', 'access.overrides.manage'],
}));

test('owner transfer', async ({ page }) => runConsoleJourney(page, {
  scenario: 'owner transfer', path: '/settings/access', assertions: ['创建', '预览', 'Step-up', '接受或取消', '审计'],
  operations: ['access.ownership.read', 'access.ownership.transfers.preview', 'access.ownership.transfers.create', 'access.ownership.transfers.accept'],
}));

test('approval template', async ({ page }) => runConsoleJourney(page, {
  scenario: 'approval template', path: '/settings/approvals', assertions: ['新建', '修订', '启停', '版本冻结'],
  operations: ['approval.templates.list', 'approval.templates.create', 'approval.templates.revise', 'approval.templates.enable', 'approval.templates.disable'],
}));

test('approval task', async ({ page }) => runConsoleJourney(page, {
  scenario: 'approval task', path: '/tasks', assertions: ['提交', '任务', '职责分离', '批准或拒绝', 'Proof消耗'],
  operations: ['approval.tasks.list', 'approval.tasks.approve', 'approval.tasks.reject'],
}));
