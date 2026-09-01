import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { FinancePolicyPageSchema } from './FinanceAuthoritySchema';
import { FinancePolicyEditor } from './FinancePolicyEditor';

afterEach(cleanup);

describe('FinancePolicyEditor', () => {
  it('restores rule kind and editor state in URL while keeping edits in local preview memory', async () => {
    const user = userEvent.setup();
    renderEditor(previewContext, previewPage(), '/finance?tab=rules');

    const navigation = screen.getByRole('navigation', { name: '财务规则类型' });
    await user.click(within(navigation).getByRole('button', { name: '税务规则' }));
    expect(screen.getByTestId('location').textContent).toContain('ruleKind=tax');
    const table = screen.getByRole('table', { name: '税务规则' });
    expect(within(table).getByText('中国标准商品增值税')).toBeTruthy();

    await user.click(within(table).getByRole('button', { name: '编辑' }));
    expect(screen.getByTestId('location').textContent).toContain('mode=edit');
    const drawer = screen.getByRole('dialog', { name: '财务规则配置' });
    const name = within(drawer).getByLabelText('规则名称');
    await user.clear(name);
    await user.type(name, '中国标准商品增值税（新版本）');
    await user.click(within(drawer).getByRole('button', { name: '保存本地草稿' }));
    expect(await within(drawer).findByText(/中国标准商品增值税（新版本）/)).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toContain('mode=view');

    await user.click(within(drawer).getByRole('button', { name: '停用（本地预览）' }));
    expect(await within(drawer).findByText('retired')).toBeTruthy();
    await user.click(within(drawer).getByRole('button', { name: '关闭财务规则配置' }));
    expect(screen.getByTestId('location').textContent).not.toContain('selected=');

    await user.click(within(navigation).getByRole('button', { name: '字段定义' }));
    expect(screen.getByRole('table', { name: '字段定义' })).toBeTruthy();
    expect(screen.getByText('免税原因')).toBeTruthy();
  });

  it('fails closed outside local preview without rendering fixture facts or enabling writes', async () => {
    const user = userEvent.setup();
    renderEditor(productionContext, managedProductionPage('active'), '/finance?tab=rules&ruleKind=tax');

    expect(screen.queryByText('中国标准商品增值税', { exact: true })).toBeNull();
    expect(screen.getByText('正式中国标准商品增值税')).toBeTruthy();
    const surface = screen.getByRole('region', { name: '税务规则' });
    expect(within(surface).getByRole<HTMLButtonElement>('button', { name: '新增税务规则' }).disabled).toBe(true);
    expect(within(surface).getByRole<HTMLButtonElement>('button', { name: '编辑' }).disabled).toBe(true);
    expect(within(surface).getByText(/缺少 finance.policy.manage/)).toBeTruthy();
    await user.click(within(surface).getByRole('button', { name: '新增税务规则' }));
    expect(screen.queryByRole('dialog', { name: '财务规则配置' })).toBeNull();
  });

  it('opens the authoritative workflow only for a fully capable production session and keeps expectedVersion unchanged', async () => {
    const user = userEvent.setup();
    renderEditor(managedProductionContext, managedProductionPage('active'), '/finance?tab=rules&ruleKind=tax');

    const table = screen.getByRole('table', { name: '税务规则' });
    expect(within(table).getByText('正式中国标准商品增值税')).toBeTruthy();
    expect(within(table).getByRole<HTMLButtonElement>('button', { name: '编辑' }).disabled).toBe(false);
    await user.click(within(table).getByRole('button', { name: '编辑' }));
    const editor = screen.getByRole('dialog', { name: '财务规则配置' });
    expect(within(editor).getByText('AUTHORITATIVE WORKFLOW')).toBeTruthy();
    const name = within(editor).getByLabelText('规则名称');
    await user.clear(name);
    await user.type(name, '正式税率新草稿');
    await user.click(within(editor).getByRole('button', { name: '保存草稿并进入权威预览' }));

    const workflow = await screen.findByRole('dialog', { name: '财务配置高风险变更' });
    expect(within(workflow).getByRole('heading', { name: '保存税务规则草稿' })).toBeTruthy();
    expect(within(workflow).getByText(/finance.policy.tax.cn.production · v6/)).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '财务规则配置' })).toBeNull();
  });

  it('shows approve and reject only to a different reviewer for pending review', async () => {
    const user = userEvent.setup();
    renderEditor(managedProductionContext, managedProductionPage('pending_review'), '/finance?tab=rules&ruleKind=tax');
    await user.click(screen.getByRole('button', { name: '正式中国标准商品增值税' }));
    const drawer = screen.getByRole('dialog', { name: '财务规则配置' });
    expect(within(drawer).getByText(/发起人不能审批自己的方案/)).toBeTruthy();
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '批准' }).disabled).toBe(false);
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '拒绝' }).disabled).toBe(false);
    await user.click(within(drawer).getByRole('button', { name: '批准' }));
    expect(await screen.findByRole('heading', { name: '批准税务规则' })).toBeTruthy();
  });

  it('fails closed when the current actor is the pending proposal initiator', async () => {
    const user = userEvent.setup();
    renderEditor(initiatorProductionContext, managedProductionPage('pending_review'), '/finance?tab=rules&ruleKind=tax');
    await user.click(screen.getByRole('button', { name: '正式中国标准商品增值税' }));
    const drawer = screen.getByRole('dialog', { name: '财务规则配置' });
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '批准' }).disabled).toBe(true);
    expect(within(drawer).getByRole<HTMLButtonElement>('button', { name: '拒绝' }).disabled).toBe(true);
  });
});

function renderEditor(context: ConsoleContext, page: ReturnType<typeof previewPage>, entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <FinancePolicyEditor context={context} page={page} previewContext={context.scope.id === 'platform:preview'} limit={50} onLimit={vi.fn()} onCursor={vi.fn()} onAuthoritativeRefresh={vi.fn()} />
      <LocationProbe />
    </MemoryRouter>
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function previewPage() {
  return FinancePolicyPageSchema.parse({
    items: [
      {
        id: 'finance.policy.tax.cn.standard',
        scope_id: 'platform:preview',
        kind: 'tax',
        state: 'active',
        version: '4',
        rule: {
          name: '中国标准商品增值税',
          countryCode: 'CN',
          taxType: 'vat',
          productTaxCategory: 'standard_goods',
          ratePpm: 130_000,
          priceInclusive: true,
          calculationMethod: 'inclusive',
          roundingMode: 'line',
          priority: 100,
          effectiveFrom: '2026-01-01',
          sourceReference: 'LOCAL-PREVIEW',
        },
      },
      {
        id: 'finance.policy.field.exemption',
        scope_id: 'platform:preview',
        kind: 'field-definition',
        state: 'active',
        version: '2',
        rule: { code: 'tax.exemption_code', label: '免税原因', appliesTo: 'tax_rule', dataType: 'select', required: false, options: ['public_welfare'], effectiveFrom: '2026-01-01' },
      },
    ],
    count: 2,
    preview: { source: 'local-preview', total: 2, page: 1 },
  });
}

function managedProductionPage(state: 'active' | 'pending_review') {
  return FinancePolicyPageSchema.parse({
    items: [
      {
        id: 'finance.policy.tax.cn.production',
        scope_id: 'enterprise:1',
        kind: 'tax',
        state,
        version: 6,
        desired_state: 'active',
        proposed_by: 'actor:initiator',
        submitted_by: state === 'pending_review' ? 'actor:initiator' : null,
        rule: {
          name: '正式中国标准商品增值税',
          countryCode: 'CN',
          taxType: 'vat',
          productTaxCategory: 'standard_goods',
          ratePpm: 130_000,
          priceInclusive: true,
          calculationMethod: 'inclusive',
          roundingMode: 'line',
          priority: 100,
          effectiveFrom: '2026-01-01',
          sourceReference: 'AUTHORITY-TAX-NOTICE',
        },
      },
    ],
    count: 1,
  });
}

const previewScope = { kind: 'platform', id: 'platform:preview' } as const;
const productionScope = { kind: 'enterprise', id: 'enterprise:1' } as const;

const previewContext = context(previewScope);
const productionContext = context(productionScope);
const managedProductionContext = managedContext('actor:reviewer');
const initiatorProductionContext = managedContext('actor:initiator');

function context(scope: ConsoleContext['scope']): ConsoleContext {
  return {
    scope,
    scopes: [scope],
    profile: { display_name: '财务验收员', employee_no: 'FIN001' },
    session: {
      actor: 'actor:finance',
      membership: 'membership:finance',
      scope,
      scopes: [scope],
      accessVersion: 1,
      permissions: ['finance.policy.read'],
      capabilities: ['finance.policies.read'],
      assurance: { level: 1 },
      target: 'member',
      syncedAt: '2026-08-30T00:00:00.000Z',
    },
  };
}

function managedContext(actor: string): ConsoleContext {
  const base = context(productionScope);
  return {
    ...base,
    session: {
      ...base.session,
      actor,
      csrf: 'csrf-finance-policy-token',
      permissions: [...base.session.permissions, 'finance.policy.manage'],
      capabilities: [...base.session.capabilities, 'identity.stepup.start', 'identity.stepup.complete', 'finance.policies.preview', 'finance.policies.manage'],
    },
  };
}
