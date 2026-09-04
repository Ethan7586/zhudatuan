import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog as AriaDialog, Form, Heading, Modal, ModalOverlay } from 'react-aria-components';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { FinanceIcon } from './FinanceIcon';
import type { FinancePolicyAction, FinancePolicyDesiredState } from './FinancePolicyCommand';
import {
  FinanceFieldDefinitionDraftSchema,
  FinanceFieldPolicySchema,
  FinanceTaxPolicySchema,
  FinanceTaxRuleDraftSchema,
  FinanceTaxRuleSchema,
  FinanceFieldDefinitionSchema,
  fieldOptions,
  type FinanceConfigPolicy,
  type FinanceFieldDefinitionDraft,
  type FinancePolicyEditorMode,
  type FinanceRuleKind,
  type FinanceTaxRuleDraft,
} from './FinancePolicyEditorSchema';

export function FinancePolicyEditorDrawer({
  context,
  kind,
  mode,
  policy,
  previewEnabled,
  productionWriteEnabled,
  open,
  onClose,
  onEdit,
  onSave,
  onRetire,
  onWorkflowAction,
}: Readonly<{
  context: ConsoleContext;
  kind: FinanceRuleKind;
  mode: FinancePolicyEditorMode | undefined;
  policy: FinanceConfigPolicy | undefined;
  previewEnabled: boolean;
  productionWriteEnabled: boolean;
  open: boolean;
  onClose: () => void;
  onEdit: (policy: FinanceConfigPolicy) => void;
  onSave: (policy: FinanceConfigPolicy) => void;
  onRetire: (policy: FinanceConfigPolicy) => void;
  onWorkflowAction: (policy: FinanceConfigPolicy, action: FinancePolicyAction, desiredState: FinancePolicyDesiredState) => void;
}>) {
  return (
    <ModalOverlay
      className="financedraweroverlay"
      isOpen={open}
      isDismissable
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Modal className="financedrawermodal financeconfigdrawermodal">
        <AriaDialog className="financedrawer financeconfigdrawer" aria-label="财务规则配置">
          {!open || mode === undefined ? null : (
            <>
              <header className="financedrawerheader">
                <button className="financedrawerback" type="button" onClick={onClose}>
                  <FinanceIcon name="arrowLeft" />
                  返回规则列表
                </button>
                <button className="financedrawerclose" type="button" onClick={onClose} aria-label="关闭财务规则配置">
                  <FinanceIcon name="close" />
                </button>
                <div className="financedrawertitle">
                  <Heading slot="title">{drawerTitle(kind, mode)}</Heading>
                  <span className="financedrawerbadges">
                    <strong>{previewEnabled ? 'LOCAL SESSION PREVIEW' : 'AUTHORITATIVE WORKFLOW'}</strong>
                    <span>{previewEnabled ? '不写入服务端' : productionWriteEnabled ? 'Level 3 · 四眼审批' : '只读'}</span>
                  </span>
                </div>
              </header>
              <div className="financeconfigdrawerbody">
                {previewEnabled ? (
                  <p className="financepreviewboundary" role="status">
                    <FinanceIcon name="shield" />
                    本抽屉的保存与停用只修改当前页面内存；刷新即恢复，不发送服务端请求。
                  </p>
                ) : productionWriteEnabled ? (
                  <p className="financeconfigguard" role="status">
                    <FinanceIcon name="shield" />
                    保存、提交、批准、拒绝或停用都将进入服务端权威预览、Level 3、动作绑定 proof 与权威回读。
                  </p>
                ) : null}
                {!previewEnabled && !productionWriteEnabled ? (
                  <ProductionBlocked />
                ) : mode === 'view' && policy !== undefined ? (
                  <PolicyDetail
                    policy={policy}
                    actor={context.session.actor}
                    localPreview={previewEnabled}
                    writeEnabled={previewEnabled || productionWriteEnabled}
                    onEdit={onEdit}
                    onRetire={onRetire}
                    onWorkflowAction={onWorkflowAction}
                    onClose={onClose}
                  />
                ) : kind === 'tax' ? (
                  <TaxRuleForm key={`${mode}:${policy?.id ?? 'new'}`} context={context} policy={policy?.kind === 'tax' ? policy : undefined} localPreview={previewEnabled} onSave={onSave} onClose={onClose} />
                ) : kind === 'fields' ? (
                  <FieldDefinitionForm key={`${mode}:${policy?.id ?? 'new'}`} context={context} policy={policy?.kind === 'field-definition' ? policy : undefined} localPreview={previewEnabled} onSave={onSave} onClose={onClose} />
                ) : null}
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function TaxRuleForm({
  context,
  policy,
  localPreview,
  onSave,
  onClose,
}: Readonly<{ context: ConsoleContext; policy: Extract<FinanceConfigPolicy, { kind: 'tax' }> | undefined; localPreview: boolean; onSave: (policy: FinanceConfigPolicy) => void; onClose: () => void }>) {
  const form = useForm<FinanceTaxRuleDraft>({ resolver: zodResolver(FinanceTaxRuleDraftSchema), defaultValues: taxDefaults(policy) });
  return (
    <Form
      className="financeconfigform"
      onSubmit={(event) => {
        void form.handleSubmit((draft) => onSave(taxPolicy(context, draft, policy)))(event);
      }}
    >
      <fieldset>
        <legend>适用范围与税率</legend>
        <div className="financeconfigformgrid">
          <Field label="规则名称">
            <input {...form.register('name')} />
          </Field>
          <Field label="国家代码">
            <input {...form.register('countryCode')} placeholder="CN" maxLength={2} />
          </Field>
          <Field label="省 / 州代码">
            <input {...form.register('regionCode')} placeholder="可选" />
          </Field>
          <Field label="税种">
            <select {...form.register('taxType')}>
              <option value="vat">VAT</option>
              <option value="gst">GST</option>
              <option value="sales_tax">Sales Tax</option>
              <option value="excise">消费税</option>
              <option value="customs">关税</option>
            </select>
          </Field>
          <Field label="商品税务分类">
            <input {...form.register('productTaxCategory')} placeholder="standard_goods" />
          </Field>
          <Field label="HS Code">
            <input {...form.register('hsCode')} placeholder="可选" />
          </Field>
          <Field label="税率（ppm）">
            <input type="number" min="0" max="1000000" step="1" {...form.register('ratePpm', { valueAsNumber: true })} />
            <small>60,000 ppm = 6%</small>
          </Field>
          <Field label="优先级">
            <input type="number" min="0" max="10000" step="1" {...form.register('priority', { valueAsNumber: true })} />
          </Field>
        </div>
      </fieldset>
      <fieldset>
        <legend>计税与有效期</legend>
        <div className="financeconfigformgrid">
          <Field label="计算方式">
            <select {...form.register('calculationMethod')}>
              <option value="exclusive">价外税</option>
              <option value="inclusive">价内税</option>
              <option value="compound">复合税</option>
            </select>
          </Field>
          <Field label="取整方式">
            <select {...form.register('roundingMode')}>
              <option value="line">逐行取整</option>
              <option value="order">订单取整</option>
              <option value="invoice">发票取整</option>
            </select>
          </Field>
          <Field label="生效日期">
            <input type="date" {...form.register('effectiveFrom')} />
          </Field>
          <Field label="失效日期">
            <input type="date" {...form.register('effectiveTo')} />
          </Field>
          <label className="financeconfigcheck">
            <input type="checkbox" {...form.register('priceInclusive')} />
            商品标价已含税
          </label>
          <Field label="政策 / 来源依据" wide>
            <textarea rows={3} {...form.register('sourceReference')} />
          </Field>
        </div>
      </fieldset>
      <FormErrors errors={form.formState.errors} />
      <EditorActions saving={form.formState.isSubmitting} localPreview={localPreview} onClose={onClose} />
    </Form>
  );
}

function FieldDefinitionForm({
  context,
  policy,
  localPreview,
  onSave,
  onClose,
}: Readonly<{ context: ConsoleContext; policy: Extract<FinanceConfigPolicy, { kind: 'field-definition' }> | undefined; localPreview: boolean; onSave: (policy: FinanceConfigPolicy) => void; onClose: () => void }>) {
  const form = useForm<FinanceFieldDefinitionDraft>({ resolver: zodResolver(FinanceFieldDefinitionDraftSchema), defaultValues: fieldDefaults(policy) });
  const dataType = form.watch('dataType');
  return (
    <Form
      className="financeconfigform"
      onSubmit={(event) => {
        void form.handleSubmit((draft) => onSave(fieldPolicy(context, draft, policy)))(event);
      }}
    >
      <fieldset>
        <legend>字段定义</legend>
        <div className="financeconfigformgrid">
          <Field label="字段代码">
            <input {...form.register('code')} disabled={policy !== undefined} placeholder="tax.exemption_code" />
            <small>建立后不可修改</small>
          </Field>
          <Field label="显示名称">
            <input {...form.register('label')} />
          </Field>
          <Field label="适用对象">
            <select {...form.register('appliesTo')}>
              <option value="tax_rule">税务规则</option>
              <option value="invoice">发票</option>
              <option value="settlement">结算</option>
              <option value="reconciliation">对账</option>
              <option value="journal">账本</option>
              <option value="accounts_receivable">订单应收</option>
              <option value="accounts_payable">供应商应付</option>
              <option value="channel_clearing">渠道清算</option>
              <option value="distributor_commission">分销佣金</option>
              <option value="withdrawal">提现</option>
              <option value="period_close">期间关闭</option>
            </select>
          </Field>
          <Field label="数据类型">
            <select {...form.register('dataType')}>
              <option value="text">文本</option>
              <option value="integer">整数</option>
              <option value="decimal">小数</option>
              <option value="date">日期</option>
              <option value="datetime">日期时间</option>
              <option value="boolean">布尔</option>
              <option value="select">单选</option>
              <option value="multiselect">多选</option>
              <option value="country">国家</option>
              <option value="region">地区</option>
              <option value="currency">币种</option>
              <option value="money">金额</option>
              <option value="percentage">百分比</option>
              <option value="reference">业务引用</option>
            </select>
          </Field>
          <Field label="单位">
            <input {...form.register('unit')} placeholder="可选" />
          </Field>
          <label className="financeconfigcheck">
            <input type="checkbox" {...form.register('required')} />
            必填字段
          </label>
          <Field label="选项（逗号或换行分隔）" wide>
            <textarea rows={3} {...form.register('optionsText')} disabled={dataType !== 'select' && dataType !== 'multiselect'} />
          </Field>
          <Field label="说明" wide>
            <textarea rows={2} {...form.register('description')} />
          </Field>
          <Field label="生效日期">
            <input type="date" {...form.register('effectiveFrom')} />
          </Field>
          <Field label="失效日期">
            <input type="date" {...form.register('effectiveTo')} />
          </Field>
        </div>
      </fieldset>
      <p className="financeconfigguard">
        <FinanceIcon name="info" />
        自定义字段仅保存受控 metadata；不能直接驱动税额、账务分录或结算金额。
      </p>
      <FormErrors errors={form.formState.errors} />
      <EditorActions saving={form.formState.isSubmitting} localPreview={localPreview} onClose={onClose} />
    </Form>
  );
}

function PolicyDetail({
  policy,
  actor,
  localPreview,
  writeEnabled,
  onEdit,
  onRetire,
  onWorkflowAction,
  onClose,
}: Readonly<{
  policy: FinanceConfigPolicy;
  actor: string;
  localPreview: boolean;
  writeEnabled: boolean;
  onEdit: (policy: FinanceConfigPolicy) => void;
  onRetire: (policy: FinanceConfigPolicy) => void;
  onWorkflowAction: (policy: FinanceConfigPolicy, action: FinancePolicyAction, desiredState: FinancePolicyDesiredState) => void;
  onClose: () => void;
}>) {
  const desiredState = policy.desired_state ?? 'active';
  const initiator = policy.submitted_by ?? policy.proposed_by;
  const canDecide = writeEnabled && !localPreview && initiator !== undefined && initiator !== null && initiator !== actor;
  return (
    <div className="financeconfigdetail">
      <dl>
        <div>
          <dt>配置 ID</dt>
          <dd>{policy.id}</dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>{policy.scope_id}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{policy.state}</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>v{policy.version}</dd>
        </div>
        <div>
          <dt>目标状态</dt>
          <dd>{desiredState}</dd>
        </div>
        <div>
          <dt>发起 / 提交人</dt>
          <dd>
            {policy.proposed_by ?? '—'} / {policy.submitted_by ?? '—'}
          </dd>
        </div>
      </dl>
      <section>
        <h3>服务端形状预览</h3>
        <pre>{JSON.stringify(policy.rule, null, 2)}</pre>
      </section>
      <p className="financeconfigguard">
        <FinanceIcon name="shield" />
        {localPreview ? '编辑生效配置会产生新的本地草稿版本，不原地覆盖历史事实。' : '生效配置不会被原地覆盖；发起人不能审批自己的方案，最终动作必须由另一位财务复核人批准。'}
      </p>
      <footer className="financeconfigactionsbar">
        <button type="button" onClick={onClose}>
          返回
        </button>
        <button type="button" disabled={!writeEnabled || policy.state === 'pending_review'} onClick={() => onEdit(policy)}>
          编辑并建立新版本
        </button>
        <button type="button" disabled={!writeEnabled || policy.state === 'retired' || policy.state === 'pending_review'} onClick={() => onRetire(policy)}>
          {localPreview ? '停用（本地预览）' : '申请停用'}
        </button>
        {localPreview ? (
          <button type="button" disabled>
            提交财务复核
          </button>
        ) : null}
        {!localPreview && policy.state === 'draft' ? (
          <button type="button" disabled={!writeEnabled} onClick={() => onWorkflowAction(policy, 'submit', desiredState)}>
            提交财务复核
          </button>
        ) : null}
        {!localPreview && policy.state === 'pending_review' ? (
          <>
            <button type="button" disabled={!canDecide} onClick={() => onWorkflowAction(policy, 'approve', desiredState)}>
              批准
            </button>
            <button type="button" disabled={!canDecide} onClick={() => onWorkflowAction(policy, 'reject', desiredState)}>
              拒绝
            </button>
          </>
        ) : null}
      </footer>
    </div>
  );
}

function EditorActions({ saving, localPreview, onClose }: Readonly<{ saving: boolean; localPreview: boolean; onClose: () => void }>) {
  return (
    <footer className="financeconfigactionsbar">
      <button type="button" onClick={onClose}>
        取消
      </button>
      <button type="submit" disabled={saving}>
        {localPreview ? '保存本地草稿' : '保存草稿并进入权威预览'}
      </button>
      {localPreview ? (
        <button type="button" disabled>
          提交财务复核（未接入）
        </button>
      ) : null}
    </footer>
  );
}

function ProductionBlocked() {
  return (
    <section className="financeconfigunavailable" role="alert">
      <FinanceIcon name="shield" />
      <div>
        <strong>正式写入已安全关闭</strong>
        <p>未获得 typed Preview、Level 3 Step-up、action-bound proof、expectedVersion、四眼审批与回执前不会执行。</p>
      </div>
    </section>
  );
}

function Field({ label, wide = false, children }: Readonly<{ label: string; wide?: boolean; children: ReactNode }>) {
  return (
    <label className={wide ? 'financeconfigfield iswide' : 'financeconfigfield'}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function FormErrors({ errors }: Readonly<{ errors: Readonly<Record<string, unknown>> }>) {
  return Object.keys(errors).length === 0 ? null : (
    <p className="financeconfigerror" role="alert">
      请检查必填字段、日期范围、税率精度及选项配置。
    </p>
  );
}

function taxDefaults(policy: Extract<FinanceConfigPolicy, { kind: 'tax' }> | undefined): FinanceTaxRuleDraft {
  const rule = policy?.rule;
  return {
    name: rule?.name ?? '',
    countryCode: rule?.countryCode ?? 'CN',
    regionCode: rule?.regionCode ?? '',
    taxType: rule?.taxType ?? 'vat',
    productTaxCategory: rule?.productTaxCategory ?? 'standard_goods',
    hsCode: rule?.hsCode ?? '',
    ratePpm: rule?.ratePpm ?? 60_000,
    priceInclusive: rule?.priceInclusive ?? true,
    calculationMethod: rule?.calculationMethod ?? 'inclusive',
    roundingMode: rule?.roundingMode ?? 'line',
    priority: rule?.priority ?? 100,
    effectiveFrom: rule?.effectiveFrom ?? today(),
    effectiveTo: rule?.effectiveTo ?? '',
    sourceReference: rule?.sourceReference ?? '',
  };
}

function fieldDefaults(policy: Extract<FinanceConfigPolicy, { kind: 'field-definition' }> | undefined): FinanceFieldDefinitionDraft {
  const rule = policy?.rule;
  return {
    code: rule?.code ?? '',
    label: rule?.label ?? '',
    appliesTo: rule?.appliesTo ?? 'tax_rule',
    dataType: rule?.dataType ?? 'text',
    required: rule?.required ?? false,
    unit: rule?.unit ?? '',
    optionsText: rule?.options.join('\n') ?? '',
    description: rule?.description ?? '',
    effectiveFrom: rule?.effectiveFrom ?? today(),
    effectiveTo: rule?.effectiveTo ?? '',
  };
}

function taxPolicy(context: ConsoleContext, draft: FinanceTaxRuleDraft, existing: Extract<FinanceConfigPolicy, { kind: 'tax' }> | undefined): FinanceConfigPolicy {
  const rule = FinanceTaxRuleSchema.parse({ ...draft, ...(draft.regionCode === '' ? { regionCode: undefined } : {}), ...(draft.hsCode === '' ? { hsCode: undefined } : {}), ...(draft.effectiveTo === '' ? { effectiveTo: undefined } : {}) });
  return FinanceTaxPolicySchema.parse({ id: existing?.id ?? policyId(context, 'tax'), scope_id: context.scope.id, kind: 'tax', rule, state: 'draft', version: existing?.version ?? 0 });
}

function fieldPolicy(context: ConsoleContext, draft: FinanceFieldDefinitionDraft, existing: Extract<FinanceConfigPolicy, { kind: 'field-definition' }> | undefined): FinanceConfigPolicy {
  const rule = FinanceFieldDefinitionSchema.parse({
    code: draft.code,
    label: draft.label,
    appliesTo: draft.appliesTo,
    dataType: draft.dataType,
    required: draft.required,
    ...(draft.unit === '' ? {} : { unit: draft.unit }),
    options: fieldOptions(draft.optionsText),
    ...(draft.description === '' ? {} : { description: draft.description }),
    effectiveFrom: draft.effectiveFrom,
    ...(draft.effectiveTo === '' ? {} : { effectiveTo: draft.effectiveTo }),
  });
  return FinanceFieldPolicySchema.parse({ id: existing?.id ?? policyId(context, 'field'), scope_id: context.scope.id, kind: 'field-definition', rule, state: 'draft', version: existing?.version ?? 0 });
}

function drawerTitle(kind: FinanceRuleKind, mode: FinancePolicyEditorMode): string {
  const noun = kind === 'tax' ? '税务规则' : '字段定义';
  return `${mode === 'create' ? '新增' : mode === 'edit' ? '编辑' : '查看'}${noun}`;
}

function policyId(context: ConsoleContext, kind: 'tax' | 'field'): string {
  const preview = context.scope.kind === 'platform' && context.scope.id === 'platform:preview' ? '.preview' : '';
  return `finance.policy.${kind}${preview}.${globalThis.crypto.randomUUID()}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
