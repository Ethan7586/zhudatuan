import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import type { FinancePolicyPage } from './FinanceAuthoritySchema';
import { AuthorityPagination, PolicyTable } from './FinanceAuthorityTables';
import { FinanceIcon } from './FinanceIcon';
import { financePolicyWritesAvailable, type FinancePolicyAction, type FinancePolicyDesiredState } from './FinancePolicyCommand';
import { FinancePolicyEditorDrawer } from './FinancePolicyEditorDrawer';
import { FinanceConfigPolicySchema, FinancePolicyEditorModeSchema, FinanceRuleKindSchema, type FinanceConfigPolicy, type FinanceFieldPolicy, type FinanceRuleKind, type FinanceTaxPolicy } from './FinancePolicyEditorSchema';
import { FinancePolicyWorkflowDialog, type FinancePolicyWorkflowIntent } from './FinancePolicyWorkflowDialog';

export function FinancePolicyEditor({
  context,
  page,
  previewContext,
  limit,
  onLimit,
  onCursor,
  onAuthoritativeRefresh,
}: Readonly<{
  context: ConsoleContext;
  page: FinancePolicyPage;
  previewContext: boolean;
  limit: number;
  onLimit: (limit: number) => void;
  onCursor: (cursor?: string) => void;
  onAuthoritativeRefresh: () => Promise<unknown>;
}>) {
  const [search, setSearch] = useSearchParams();
  const [localPolicies, setLocalPolicies] = useState<ReadonlyMap<string, FinanceConfigPolicy>>(new Map());
  const [workflowIntent, setWorkflowIntent] = useState<FinancePolicyWorkflowIntent>();
  const scopeKey = `${context.scope.kind}:${context.scope.id}`;
  const previewEnabled = previewContext && page.preview?.source === 'local-preview';
  const productionWritesEnabled = !previewEnabled && financePolicyWritesAvailable(context);
  const reconciliationPage = previewEnabled ? previewReconciliationPolicies(page) : page;
  const ruleKind = readRuleKind(search);
  const selectedId = search.get('selected') ?? undefined;
  const mode = FinancePolicyEditorModeSchema.safeParse(search.get('mode')).success ? FinancePolicyEditorModeSchema.parse(search.get('mode')) : undefined;
  const basePolicies = useMemo(() => configPolicies(page), [page]);
  const policies = useMemo(() => mergePolicies(basePolicies, localPolicies), [basePolicies, localPolicies]);
  const selected = selectedId === undefined ? undefined : policies.find((policy) => policy.id === selectedId);

  useEffect(() => {
    setLocalPolicies(new Map());
    setWorkflowIntent(undefined);
  }, [scopeKey]);

  const updateSearch = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(search);
    mutate(next);
    setSearch(next);
  };
  const selectRuleKind = (nextKind: FinanceRuleKind) =>
    updateSearch((next) => {
      if (nextKind === 'reconciliation') next.delete('ruleKind');
      else next.set('ruleKind', nextKind);
      next.delete('selected');
      next.delete('mode');
      next.delete('cursor');
    });
  const openCreate = () =>
    updateSearch((next) => {
      next.set('selected', 'new');
      next.set('mode', 'create');
    });
  const openPolicy = (policy: FinanceConfigPolicy, nextMode: 'view' | 'edit') =>
    updateSearch((next) => {
      next.set('selected', policy.id);
      next.set('mode', nextMode);
    });
  const closeDrawer = () =>
    updateSearch((next) => {
      next.delete('selected');
      next.delete('mode');
    });
  const savePolicy = (policy: FinanceConfigPolicy) => {
    if (!previewEnabled) {
      if (productionWritesEnabled) startWorkflow(policy, 'saveDraft', 'active');
      return;
    }
    const existing = policies.find((candidate) => candidate.id === policy.id);
    const localPolicy = existing === undefined ? policy : Object.freeze({ ...policy, version: existing.version + 1 });
    setLocalPolicies((current) => new Map(current).set(localPolicy.id, localPolicy));
    updateSearch((next) => {
      next.set('selected', localPolicy.id);
      next.set('mode', 'view');
    });
  };
  const retirePolicy = (policy: FinanceConfigPolicy) => {
    if (!previewEnabled) {
      if (productionWritesEnabled) startWorkflow(policy, 'saveDraft', 'retired');
      return;
    }
    const retired = Object.freeze({ ...policy, state: 'retired' as const, version: policy.version + 1 });
    setLocalPolicies((current) => new Map(current).set(retired.id, retired));
    updateSearch((next) => {
      next.set('selected', retired.id);
      next.set('mode', 'view');
    });
  };
  const startWorkflow = (policy: FinanceConfigPolicy, action: FinancePolicyAction, desiredState: FinancePolicyDesiredState) => {
    if (!productionWritesEnabled) return;
    setWorkflowIntent({ policy, action, desiredState });
    closeDrawer();
  };

  return (
    <div className="financepolicyeditor">
      <nav className="financepolicynav" aria-label="财务规则类型">
        <RuleKindButton kind="reconciliation" active={ruleKind} onSelect={selectRuleKind}>
          对账策略
        </RuleKindButton>
        <RuleKindButton kind="tax" active={ruleKind} onSelect={selectRuleKind}>
          税务规则
        </RuleKindButton>
        <RuleKindButton kind="fields" active={ruleKind} onSelect={selectRuleKind}>
          字段定义
        </RuleKindButton>
      </nav>

      {ruleKind === 'reconciliation' ? (
        <>
          <PolicyTable page={reconciliationPage} />
          <AuthorityPagination page={reconciliationPage} limit={limit} onLimit={onLimit} onCursor={onCursor} />
        </>
      ) : (
        <ConfigSurface
          ruleKind={ruleKind}
          policies={policies}
          previewEnabled={previewEnabled}
          writeEnabled={previewEnabled || productionWritesEnabled}
          onCreate={openCreate}
          onView={(policy) => openPolicy(policy, 'view')}
          onEdit={(policy) => openPolicy(policy, 'edit')}
          onRetire={retirePolicy}
        />
      )}

      <FinancePolicyEditorDrawer
        context={context}
        kind={ruleKind}
        mode={mode}
        policy={selected}
        previewEnabled={previewEnabled}
        productionWriteEnabled={productionWritesEnabled}
        open={ruleKind !== 'reconciliation' && mode !== undefined && (mode === 'create' || selected !== undefined)}
        onClose={closeDrawer}
        onEdit={(policy) => openPolicy(policy, 'edit')}
        onSave={savePolicy}
        onRetire={retirePolicy}
        onWorkflowAction={startWorkflow}
      />
      <FinancePolicyWorkflowDialog
        context={context}
        intent={workflowIntent}
        onClose={() => setWorkflowIntent(undefined)}
        onComplete={async () => {
          await onAuthoritativeRefresh();
        }}
      />
    </div>
  );
}

function RuleKindButton({ kind, active, onSelect, children }: Readonly<{ kind: FinanceRuleKind; active: FinanceRuleKind; onSelect: (kind: FinanceRuleKind) => void; children: string }>) {
  return (
    <button type="button" aria-current={active === kind ? 'page' : undefined} onClick={() => onSelect(kind)}>
      {children}
    </button>
  );
}

function ConfigSurface({
  ruleKind,
  policies,
  previewEnabled,
  writeEnabled,
  onCreate,
  onView,
  onEdit,
  onRetire,
}: Readonly<{
  ruleKind: 'tax' | 'fields';
  policies: readonly FinanceConfigPolicy[];
  previewEnabled: boolean;
  writeEnabled: boolean;
  onCreate: () => void;
  onView: (policy: FinanceConfigPolicy) => void;
  onEdit: (policy: FinanceConfigPolicy) => void;
  onRetire: (policy: FinanceConfigPolicy) => void;
}>) {
  const matching = policies.filter((policy) => (ruleKind === 'tax' ? policy.kind === 'tax' : policy.kind === 'field-definition'));
  const noun = ruleKind === 'tax' ? '税务规则' : '字段定义';
  return (
    <section className="financeconfigsurface" aria-label={previewEnabled ? `${noun}本地预览` : noun}>
      <header>
        <div>
          <p>{previewEnabled ? 'LOCAL SESSION PREVIEW' : 'AUTHORITATIVE CONFIGURATION'}</p>
          <h3>{noun}</h3>
          <span>{previewEnabled ? '新增、编辑和停用仅保存在当前浏览器会话；刷新即恢复，不写入服务端。' : '列表来自 typed 权威读模型；写入必须完成服务端预览、Level 3、动作证明、四眼审批和权威回读。'}</span>
        </div>
        <button type="button" disabled={!writeEnabled} aria-disabled={!writeEnabled} onClick={onCreate}>
          <FinanceIcon name="plus" />
          新增{noun}
        </button>
      </header>
      {!previewEnabled && !writeEnabled ? (
        <div className="financeconfigunavailable" role="note">
          <FinanceIcon name="shield" />
          <div>
            <strong>{noun}保持只读</strong>
            <p>当前会话缺少 finance.policy.manage、typed preview/manage capability 或 CSRF；不会发送写请求。</p>
          </div>
        </div>
      ) : null}
      {!previewEnabled && writeEnabled ? (
        <p className="financeconfigguard" role="status">
          <FinanceIcon name="shield" />
          正式变更将进入 Preview → Level 3 Step-up → action-bound proof → Execute → authoritative reread；提交人与审批人必须不同。
        </p>
      ) : null}
      {matching.length === 0 ? (
        <div className="financequerystate" role="status">
          当前权威范围没有{noun}。
        </div>
      ) : null}
      {ruleKind === 'tax' && matching.length > 0 ? <TaxRuleTable policies={matching as readonly FinanceTaxPolicy[]} writeEnabled={writeEnabled} onView={onView} onEdit={onEdit} onRetire={onRetire} /> : null}
      {ruleKind === 'fields' && matching.length > 0 ? <FieldDefinitionTable policies={matching as readonly FinanceFieldPolicy[]} writeEnabled={writeEnabled} onView={onView} onEdit={onEdit} onRetire={onRetire} /> : null}
    </section>
  );
}

function TaxRuleTable({ policies, writeEnabled, onView, onEdit, onRetire }: ConfigTableProps<FinanceTaxPolicy>) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard focus is required for the horizontally scrollable table region.
    <div className="financetablewrap financeconfigtablewrap" tabIndex={0} aria-label="税务规则表格横向滚动区域">
      <table className="financetable financeconfigtable">
        <caption className="sr-only">税务规则</caption>
        <thead>
          <tr>
            <th>规则</th>
            <th>国家 / 地区</th>
            <th>商品分类</th>
            <th>税种 / 税率</th>
            <th>计税</th>
            <th>有效期</th>
            <th>状态 / 版本</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td>
                <button className="financeconfiglink" type="button" onClick={() => onView(policy)}>
                  {policy.rule.name}
                </button>
                <small>{policy.id}</small>
              </td>
              <td>
                {policy.rule.countryCode}
                {policy.rule.regionCode === undefined ? '' : ` / ${policy.rule.regionCode}`}
              </td>
              <td>
                {policy.rule.productTaxCategory}
                <small>{policy.rule.hsCode ?? '无 HS Code'}</small>
              </td>
              <td>
                {taxTypeLabel(policy.rule.taxType)}
                <strong>{formatRate(policy.rule.ratePpm)}</strong>
              </td>
              <td>
                {policy.rule.priceInclusive ? '含税' : '价外税'}
                <small>{roundingLabel(policy.rule.roundingMode)}</small>
              </td>
              <td>
                {policy.rule.effectiveFrom}
                <small>至 {policy.rule.effectiveTo ?? '长期'}</small>
              </td>
              <td>
                <span className="financereadstate" data-state={policy.state}>
                  {policy.state}
                </span>
                <small>v{policy.version}</small>
              </td>
              <td>
                <ConfigActions policy={policy} writeEnabled={writeEnabled} onEdit={onEdit} onRetire={onRetire} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldDefinitionTable({ policies, writeEnabled, onView, onEdit, onRetire }: ConfigTableProps<FinanceFieldPolicy>) {
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard focus is required for the horizontally scrollable table region.
    <div className="financetablewrap financeconfigtablewrap" tabIndex={0} aria-label="字段定义表格横向滚动区域">
      <table className="financetable financeconfigtable">
        <caption className="sr-only">字段定义</caption>
        <thead>
          <tr>
            <th>字段</th>
            <th>适用对象</th>
            <th>类型</th>
            <th>约束</th>
            <th>选项 / 单位</th>
            <th>有效期</th>
            <th>状态 / 版本</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.id}>
              <td>
                <button className="financeconfiglink" type="button" onClick={() => onView(policy)}>
                  {policy.rule.label}
                </button>
                <small>{policy.rule.code}</small>
              </td>
              <td>{appliesToLabel(policy.rule.appliesTo)}</td>
              <td>{dataTypeLabel(policy.rule.dataType)}</td>
              <td>
                {policy.rule.required ? '必填' : '选填'}
                <small>{policy.rule.description ?? '—'}</small>
              </td>
              <td>{policy.rule.options.length === 0 ? (policy.rule.unit ?? '—') : policy.rule.options.join('、')}</td>
              <td>
                {policy.rule.effectiveFrom}
                <small>至 {policy.rule.effectiveTo ?? '长期'}</small>
              </td>
              <td>
                <span className="financereadstate" data-state={policy.state}>
                  {policy.state}
                </span>
                <small>v{policy.version}</small>
              </td>
              <td>
                <ConfigActions policy={policy} writeEnabled={writeEnabled} onEdit={onEdit} onRetire={onRetire} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ConfigTableProps<TPolicy extends FinanceConfigPolicy> {
  readonly policies: readonly TPolicy[];
  readonly writeEnabled: boolean;
  readonly onView: (policy: FinanceConfigPolicy) => void;
  readonly onEdit: (policy: FinanceConfigPolicy) => void;
  readonly onRetire: (policy: FinanceConfigPolicy) => void;
}

function ConfigActions({ policy, writeEnabled, onEdit, onRetire }: Readonly<{ policy: FinanceConfigPolicy; writeEnabled: boolean; onEdit: (policy: FinanceConfigPolicy) => void; onRetire: (policy: FinanceConfigPolicy) => void }>) {
  return (
    <span className="financeconfigactions">
      <button type="button" disabled={!writeEnabled || policy.state === 'pending_review'} onClick={() => onEdit(policy)}>
        编辑
      </button>
      <button type="button" disabled={!writeEnabled || policy.state === 'retired' || policy.state === 'pending_review'} onClick={() => onRetire(policy)}>
        停用
      </button>
    </span>
  );
}

function configPolicies(page: FinancePolicyPage): readonly FinanceConfigPolicy[] {
  return Object.freeze(
    page.items.flatMap((policy) => {
      const parsed = FinanceConfigPolicySchema.safeParse(policy);
      return parsed.success ? [parsed.data] : [];
    })
  );
}

function previewReconciliationPolicies(page: FinancePolicyPage): FinancePolicyPage {
  const items = page.items.filter((policy) => policy.kind !== 'tax' && policy.kind !== 'field-definition');
  return {
    items,
    count: items.length,
    preview: {
      source: 'local-preview',
      total: items.length,
      page: 1,
    },
  };
}

function mergePolicies(base: readonly FinanceConfigPolicy[], local: ReadonlyMap<string, FinanceConfigPolicy>): readonly FinanceConfigPolicy[] {
  return Object.freeze([...base.filter((policy) => !local.has(policy.id)), ...local.values()].sort((left, right) => left.id.localeCompare(right.id)));
}

function readRuleKind(search: URLSearchParams): FinanceRuleKind {
  const parsed = FinanceRuleKindSchema.safeParse(search.get('ruleKind') ?? 'reconciliation');
  return parsed.success ? parsed.data : 'reconciliation';
}

function formatRate(ratePpm: number): string {
  return `${Number((ratePpm / 10_000).toFixed(4))}%`;
}

function taxTypeLabel(value: FinanceTaxPolicy['rule']['taxType']): string {
  return ({ vat: 'VAT', gst: 'GST', sales_tax: 'Sales Tax', excise: '消费税', customs: '关税' } as const)[value];
}

function roundingLabel(value: FinanceTaxPolicy['rule']['roundingMode']): string {
  return ({ line: '逐行取整', order: '订单取整', invoice: '发票取整' } as const)[value];
}

function appliesToLabel(value: FinanceFieldPolicy['rule']['appliesTo']): string {
  return (
    {
      tax_rule: '税务规则',
      invoice: '发票',
      settlement: '结算',
      reconciliation: '对账',
      journal: '账本',
      accounts_receivable: '订单应收',
      accounts_payable: '供应商应付',
      channel_clearing: '渠道清算',
      distributor_commission: '分销佣金',
      withdrawal: '提现',
      period_close: '期间关闭',
    } as const
  )[value];
}

function dataTypeLabel(value: FinanceFieldPolicy['rule']['dataType']): string {
  return (
    {
      text: '文本',
      integer: '整数',
      decimal: '小数',
      date: '日期',
      datetime: '日期时间',
      boolean: '布尔',
      select: '单选',
      multiselect: '多选',
      country: '国家',
      region: '地区',
      currency: '币种',
      money: '金额',
      percentage: '百分比',
      reference: '业务引用',
    } as const
  )[value];
}
