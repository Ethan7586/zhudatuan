import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { ProductIcon } from './ProductIcon';
import { ProductFilterSchema, type ProductFilter, type ProductPagePreview } from './ProductSchema';

export interface ProductFilterProps {
  readonly value: ProductFilter;
  readonly preview?: ProductPagePreview;
  readonly onApply: (value: ProductFilter) => void;
  readonly onColumns: () => void;
}

const emptyFilter: ProductFilter = Object.freeze({ q: '', category: '', supplier: '', mall: '', status: '' });
const managementStatuses = Object.freeze([
  ['needs_attention', '待完善'],
  ['pending_review', '待审核'],
  ['published', '已上架'],
  ['unpublished', '已下架'],
] as const);

export function ProductFilterForm({ value, preview, onApply, onColumns }: ProductFilterProps) {
  const form = useForm<ProductFilter>({ resolver: zodResolver(ProductFilterSchema), values: value });
  const previewEnabled = preview?.kind === 'console-product-v1';
  const reset = () => {
    form.reset(emptyFilter);
    if (Object.values(value).some((entry) => entry !== '')) onApply(emptyFilter);
  };

  return (
    <Form
      className="producttoolbar"
      onSubmit={(event) => {
        void form.handleSubmit(onApply)(event);
      }}
    >
      <TextField className="productsearchfield">
        <Label className="sr-only">商品搜索</Label>
        <ProductIcon name="search" />
        <Input {...form.register('q')} placeholder={previewEnabled ? '搜索商品名称、SPU、SKU、条码或供应商' : '搜索商品名称或 SKU'} />
        <button className="productsearchsubmit" type="submit" aria-label="筛选">
          <ProductIcon name="arrowRight" />
        </button>
      </TextField>

      {previewEnabled ? (
        <PreviewSelect label="分类" disabled={false} registration={form.register('category')} options={preview.facets.categories.map((facet) => [facet.value, facet.label])} />
      ) : (
        <TextField className="productcompactfield">
          <Label className="sr-only">分类编号</Label>
          <Input {...form.register('category')} placeholder="分类编号" />
        </TextField>
      )}

      <PreviewSelect label="供应商" disabled={!previewEnabled} registration={form.register('supplier')} options={preview?.facets.suppliers.map((facet) => [facet.value, facet.label]) ?? []} />
      <PreviewSelect label="商城范围" disabled={!previewEnabled} registration={form.register('mall')} options={preview?.facets.malls.map((facet) => [facet.value, facet.label]) ?? []} />
      <PreviewSelect label="状态" disabled={false} registration={form.register('status')}
        options={preview?.facets.statuses.map((facet) => [facet.value, facet.label]) ?? managementStatuses} />

      <button className="producttoolbutton" type="button" disabled aria-label="更多条件" title="需要更多服务端过滤合同">
        <ProductIcon name="filter" />
        更多筛选
        <ProductIcon name="chevron" />
      </button>
      <button className="productreset" type="button" onClick={reset}>
        重置
      </button>
      <span className="producttoolspacer" />
      <button className="producttoolbutton" type="button" onClick={onColumns}>
        <ProductIcon name="settings" />
        列设置
      </button>
      <p id="previewfilterboundary" className="sr-only">
        供应商和商城范围筛选只在本地预览数据中可用；状态筛选由正式商品列表提供。
      </p>
    </Form>
  );
}

interface PreviewSelectProps {
  readonly label: string;
  readonly disabled: boolean;
  readonly registration: UseFormRegisterReturn;
  readonly options: readonly (readonly [string, string])[];
}

function PreviewSelect({ label, disabled, registration, options }: PreviewSelectProps) {
  return (
    <label className="productselectcontrol" title={disabled ? `${label}筛选等待服务端合同` : undefined}>
      <span className="sr-only">{label}</span>
      <select {...registration} disabled={disabled} aria-describedby={disabled ? 'previewfilterboundary' : undefined}>
        <option value="">{label}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <ProductIcon name="chevron" />
    </label>
  );
}
