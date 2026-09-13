import { Button } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { scopePath } from '../../shared/url/ScopePath';
import { canCreateCatalogImport, createCatalogImport, manualCatalogPackage, type ManualProductDraft } from './ProductImportCommand';
import { ProductImportDialog } from './ProductImportDialog';
import { ProductIcon } from './ProductIcon';
import './owned-product-create.css';
import './product-dialogs.css';

type CreateStep = 'basic' | 'offer' | 'service';

interface OwnedProductForm {
  readonly title: string;
  readonly subtitle: string;
  readonly category: string;
  readonly brand: string;
  readonly productType: ManualProductDraft['productType'];
  readonly unit: string;
  readonly mediaUrl: string;
  readonly specification: string;
  readonly amount: string;
  readonly compareAmount: string;
  readonly costAmount: string;
  readonly available: string;
  readonly weightGrams: string;
  readonly deliveryMethod: string;
  readonly shippingTemplate: string;
  readonly purchaseLimit: string;
  readonly afterSales: string;
  readonly description: string;
}

const emptyForm: OwnedProductForm = Object.freeze({
  title: '', subtitle: '', category: '', brand: '', productType: 'physical', unit: '件', mediaUrl: '',
  specification: '标准', amount: '', compareAmount: '', costAmount: '', available: '0', weightGrams: '',
  deliveryMethod: 'express', shippingTemplate: '', purchaseLimit: '', afterSales: '', description: '',
});

const steps: readonly Readonly<{ key: CreateStep; number: number; label: string }>[] = Object.freeze([
  { key: 'basic', number: 1, label: '基础信息' },
  { key: 'offer', number: 2, label: '规格与价格' },
  { key: 'service', number: 3, label: '配送与服务' },
]);

export function Component() {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const mode = search.get('mode') === 'batch' ? 'batch' : 'single';
  const draftKey = `console:owned-product-draft:${context.scope.kind}:${context.scope.id}`;
  const [form, setForm] = useState<OwnedProductForm>(() => readDraft(draftKey));
  const [step, setStep] = useState<CreateStep>('basic');
  const [feedback, setFeedback] = useState<string>();
  const mediaInput = useRef<HTMLInputElement>(null);
  const skuCode = useMemo(() => `OWN-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, []);
  const available = canCreateCatalogImport(context);
  const productsPath = scopePath(context.scope, 'products');
  const validImage = httpsUrl(form.mediaUrl);
  const completion = completionState(form, validImage);
  const mutation = useMutation({
    mutationFn: (draft: ManualProductDraft) => createCatalogImport(context, 'console-owned-product.json', manualCatalogPackage(draft)),
    onSuccess: (receipt) => {
      window.localStorage.removeItem(draftKey);
      void navigate(scopePath(context.scope, `imports/catalog/${encodeURIComponent(receipt.id)}`));
    },
  });

  const change = (field: keyof OwnedProductForm) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = event.currentTarget.value;
    setForm((current) => ({ ...current, [field]: value }));
    setFeedback(undefined);
    mutation.reset();
  };

  const next = () => {
    const issue = stepIssue(step, form, validImage);
    if (issue !== undefined) { setFeedback(issue); return; }
    setFeedback(undefined);
    setStep(step === 'basic' ? 'offer' : 'service');
  };

  const saveLocalDraft = () => {
    window.localStorage.setItem(draftKey, JSON.stringify(form));
    setFeedback('草稿已保存在当前浏览器，可稍后继续填写。');
  };

  const submit = () => {
    const issue = completeIssue(form, validImage);
    if (issue !== undefined) { setFeedback(issue); return; }
    if (!available) { setFeedback('当前商城没有自有商品创建权限。'); return; }
    mutation.mutate(toManualDraft(form, skuCode));
  };

  return (
    <section className="ownedproductpage">
      <header className="ownedproductheader">
        <nav aria-label="面包屑"><button type="button" onClick={() => { void navigate(`${productsPath}?workspace=free`); }}>商品管理</button><span>/</span><span>自有商品</span><span>/</span><strong>新建</strong></nav>
        <h1>新建自有商品</h1>
        <p>创建当前商城自主经营的商品</p>
      </header>

      <nav className="ownedproductmodes" aria-label="自有商品添加方式">
        <button type="button" aria-current={mode === 'single' ? 'page' : undefined} onClick={() => setSearch({})}>
          <ProductIcon name="plus" /><span><strong>单个录入</strong><small>逐项创建一件商品</small></span>
        </button>
        <button type="button" aria-current={mode === 'batch' ? 'page' : undefined} onClick={() => setSearch({ mode: 'batch' })}>
          <ProductIcon name="upload" /><span><strong>批量导入</strong><small>通过标准模板导入一批商品</small></span>
        </button>
      </nav>

      {mode === 'batch' ? (
        <ProductImportDialog context={context} open embedded
          onClose={() => { void navigate(`${productsPath}?workspace=free`); }}
          onCreated={(jobId) => { void navigate(scopePath(context.scope, `imports/catalog/${encodeURIComponent(jobId)}`)); }} />
      ) : <>
      <nav className="ownedproductsteps" aria-label="商品创建步骤">
        {steps.map((item) => <button type="button" key={item.key} aria-current={step === item.key ? 'step' : undefined}
          onClick={() => setStep(item.key)}><span>{item.number}</span><strong>{item.label}</strong></button>)}
      </nav>

      <div className="ownedproductworkspace">
        <main>
          {step === 'basic' ? <>
            <section className="ownedproductcard ownedproductmedia" aria-labelledby="owned-media-title">
              <header><h2 id="owned-media-title">商品图片</h2><small>建议 1:1，最多 5 张</small></header>
              <div className="ownedproductmediarow">
                <button className="ownedproductcover" type="button" onClick={() => mediaInput.current?.focus()}>
                  {validImage ? <img src={form.mediaUrl} alt="商品主图预览" /> : <><ProductIcon name="upload" /><strong>添加主图地址</strong></>}
                </button>
                {[1, 2, 3, 4].map((position) => <span className="ownedproductthumb" key={position}><ProductIcon name="plus" /></span>)}
              </div>
              <label>图片 HTTPS 地址<input ref={mediaInput} type="url" value={form.mediaUrl} onChange={change('mediaUrl')}
                placeholder="https://media.example.com/product.jpg" /></label>
            </section>

            <section className="ownedproductcard" aria-labelledby="owned-basic-title">
              <h2 id="owned-basic-title">基础信息</h2>
              <div className="ownedproductgrid">
                <label>商品标题 <em>*</em><input value={form.title} onChange={change('title')} maxLength={300} placeholder="请输入商品标题" /></label>
                <label>商品副标题<input value={form.subtitle} onChange={change('subtitle')} maxLength={200} placeholder="请输入商品副标题（可选）" /></label>
                <label>商品分类 <em>*</em><input value={form.category} onChange={change('category')} maxLength={128} placeholder="请输入分类编码，如 personal" /></label>
                <label>品牌（可选）<input value={form.brand} onChange={change('brand')} maxLength={120} placeholder="请输入品牌名称" /></label>
                <label>商品类型 <em>*</em><select value={form.productType} onChange={change('productType')}>
                  <option value="physical">实物商品</option><option value="virtual">虚拟商品</option>
                  <option value="service">服务商品</option><option value="voucher">券码商品</option>
                </select></label>
                <label>商品单位 <em>*</em><input value={form.unit} onChange={change('unit')} maxLength={20} placeholder="件" /></label>
              </div>
            </section>
          </> : null}

          {step === 'offer' ? <section className="ownedproductcard" aria-labelledby="owned-offer-title">
            <header><h2 id="owned-offer-title">规格与价格</h2><div className="ownedproductsegments"><button type="button" aria-pressed="true">单规格</button><button type="button" disabled title="多规格商品将在后续版本开放">多规格</button></div></header>
            <div className="ownedproductgrid ownedproductoffergrid">
              <label>SKU 编码<input value={skuCode} disabled /></label>
              <label>规格<input value={form.specification} onChange={change('specification')} maxLength={200} /></label>
              <label>售价（元） <em>*</em><input value={form.amount} onChange={change('amount')} inputMode="decimal" placeholder="99.00" /></label>
              <label>划线价（元）<input value={form.compareAmount} onChange={change('compareAmount')} inputMode="decimal" placeholder="129.00（可选）" /></label>
              <label>成本价（元）<input value={form.costAmount} onChange={change('costAmount')} inputMode="decimal" placeholder="可选" /></label>
              <label>可用库存 <em>*</em><input value={form.available} onChange={change('available')} inputMode="numeric" /></label>
            </div>
            <p className="ownedproducthint"><ProductIcon name="check" />SKU 编码由系统自动生成，创建完成后进入商品目录。</p>
          </section> : null}

          {step === 'service' ? <>
            <section className="ownedproductcard" aria-labelledby="owned-service-title">
              <h2 id="owned-service-title">配送与服务</h2>
              <div className="ownedproductgrid">
                <label>配送方式 <em>*</em><select value={form.deliveryMethod} onChange={change('deliveryMethod')}>
                  <option value="express">快递配送</option><option value="pickup">到店自提</option><option value="virtual">无需物流</option>
                </select></label>
                <label>商品重量（克）<input value={form.weightGrams} onChange={change('weightGrams')} inputMode="numeric" placeholder="可选" /></label>
                <label>运费模板<input value={form.shippingTemplate} onChange={change('shippingTemplate')} maxLength={100} placeholder="默认运费模板" /></label>
                <label>每人限购<input value={form.purchaseLimit} onChange={change('purchaseLimit')} inputMode="numeric" placeholder="不填表示不限购" /></label>
                <label className="ownedproductwide">售后说明<textarea value={form.afterSales} onChange={change('afterSales')} rows={3} maxLength={500} placeholder="退换货条件、客服说明等（可选）" /></label>
              </div>
            </section>
            <section className="ownedproductcard" aria-labelledby="owned-description-title">
              <h2 id="owned-description-title">商品详情</h2>
              <label className="ownedproductdescription">商品描述 <em>*</em><textarea value={form.description} onChange={change('description')} rows={7} maxLength={5000} placeholder="介绍商品卖点、材质、使用方式和注意事项" /></label>
            </section>
          </> : null}
        </main>

        <aside className="ownedproductpreview" aria-label="商品实时预览">
          <header><h2>商品预览</h2><span>草稿</span></header>
          <div className="ownedproductpreviewcard">
            {validImage ? <img src={form.mediaUrl} alt="商品预览" /> : <div><ProductIcon name="inventory" /></div>}
            <strong>{form.title.trim() || '商品标题将在这里显示'}</strong>
            {form.subtitle.trim() === '' ? null : <small>{form.subtitle}</small>}
            <b>{displayMoney(form.amount)}</b>
          </div>
          <div className="ownedproductcompletion">
            <header><strong>资料完整度</strong><b>{completion.percent}%</b></header>
            <div role="progressbar" aria-label="资料完整度" aria-valuenow={completion.percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completion.percent}%` }} /></div>
            <ul>{completion.items.map((item) => <li key={item.label} data-complete={item.complete}><span>{item.complete ? '✓' : ''}</span>{item.label}</li>)}</ul>
          </div>
          <p><ProductIcon name="warning" />完善商品信息后，进入服务端预览确认并保存为商品草稿。</p>
        </aside>
      </div>

      <footer className="ownedproductactions">
        <div>{feedback === undefined ? null : <p role="status">{feedback}</p>}{mutation.error === null ? null : <p role="alert">{mutation.error instanceof Error ? mutation.error.message : '商品提交失败'}</p>}</div>
        <Button onPress={() => { void navigate(`${productsPath}?workspace=free`); }}>取消</Button>
        <Button onPress={saveLocalDraft}>保存草稿</Button>
        {step === 'service'
          ? <Button tone="primary" isPending={mutation.isPending} isDisabled={mutation.isPending} onPress={submit}>预览并确认</Button>
          : <Button tone="primary" onPress={next}>下一步：{step === 'basic' ? '规格与价格' : '配送与服务'}</Button>}
      </footer>
      </>}
    </section>
  );
}

function readDraft(key: string): OwnedProductForm {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return emptyForm;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof OwnedProductForm, unknown>>;
    const next = { ...emptyForm } as Record<keyof OwnedProductForm, string>;
    for (const key of Object.keys(emptyForm) as (keyof OwnedProductForm)[]) if (typeof value[key] === 'string') next[key] = value[key];
    return next as unknown as OwnedProductForm;
  } catch { return emptyForm; }
}

function httpsUrl(value: string): boolean {
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function stepIssue(step: CreateStep, form: OwnedProductForm, validImage: boolean): string | undefined {
  if (step === 'basic') {
    if (form.title.trim() === '') return '请填写商品标题。';
    if (form.category.trim() === '') return '请填写商品分类编码。';
    if (form.unit.trim() === '') return '请填写商品单位。';
    if (!validImage) return '请填写有效的 HTTPS 商品图片地址。';
  }
  if (step === 'offer') {
    try {
      const amount = money(form.amount, '售价');
      const compare = optionalMoney(form.compareAmount, '划线价');
      optionalMoney(form.costAmount, '成本价');
      if (compare !== undefined && compare < amount) return '划线价不能低于售价。';
      integer(form.available, '库存');
    } catch (cause) { return cause instanceof Error ? cause.message : '请检查价格和库存。'; }
  }
  if (step === 'service' && form.description.trim() === '') return '请填写商品描述。';
  return undefined;
}

function completeIssue(form: OwnedProductForm, validImage: boolean): string | undefined {
  return stepIssue('basic', form, validImage) ?? stepIssue('offer', form, validImage) ?? stepIssue('service', form, validImage);
}

function toManualDraft(form: OwnedProductForm, skuCode: string): ManualProductDraft {
  const attributes: Record<string, string | number> = { subtitle: form.subtitle.trim(), brand: form.brand.trim(), unit: form.unit.trim(),
    deliveryMethod: form.deliveryMethod, shippingTemplate: form.shippingTemplate.trim(), afterSales: form.afterSales.trim() };
  const cost = optionalMoney(form.costAmount, '成本价');
  const compare = optionalMoney(form.compareAmount, '划线价');
  const weight = optionalInteger(form.weightGrams, '商品重量');
  const limit = optionalInteger(form.purchaseLimit, '限购数量');
  if (cost !== undefined) attributes.procurementCostMinor = cost;
  if (weight !== undefined) attributes.weightGrams = weight;
  if (limit !== undefined) attributes.purchaseLimit = limit;
  return {
    title: form.title.trim(), description: form.description.trim(), category: form.category.trim(), productType: form.productType,
    skuCode, mediaUrl: form.mediaUrl.trim(), amountMinor: money(form.amount, '售价'),
    ...(compare === undefined ? {} : { compareMinor: compare }),
    available: integer(form.available, '库存'), specifications: { 规格: form.specification.trim() || '标准' }, attributes,
  };
}

function completionState(form: OwnedProductForm, validImage: boolean) {
  const items = [
    { label: '商品图片', complete: validImage },
    { label: '基础资料', complete: form.title.trim() !== '' && form.category.trim() !== '' && form.unit.trim() !== '' },
    { label: '售价与库存', complete: validMoney(form.amount) && /^\d+$/.test(form.available) },
    { label: '配送信息', complete: form.deliveryMethod !== '' && form.description.trim() !== '' },
  ];
  return { items, percent: items.filter((item) => item.complete).length * 25 };
}

function displayMoney(value: string): string {
  return validMoney(value) ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(Number(value)) : '¥99.00';
}

function validMoney(value: string): boolean { return /^(0|[1-9]\d{0,12})(\.\d{1,2})?$/.test(value.trim()); }

function money(value: string, label: string): number {
  if (!validMoney(value)) throw new Error(`${label}须为最多两位小数的非负金额。`);
  return Math.round(Number(value) * 100);
}

function optionalMoney(value: string, label: string): number | undefined { return value.trim() === '' ? undefined : money(value, label); }

function integer(value: string, label: string): number {
  if (!/^(0|[1-9]\d{0,14})$/.test(value.trim())) throw new Error(`${label}须为非负整数。`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label}超出可支持范围。`);
  return parsed;
}

function optionalInteger(value: string, label: string): number | undefined { return value.trim() === '' ? undefined : integer(value, label); }
