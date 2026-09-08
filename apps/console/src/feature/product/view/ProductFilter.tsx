import { Form, Input, Label, TextField } from 'react-aria-components';
import { Button } from '@shop/design';
import { ProductIcon } from './ProductIcon';
import type { ProductFilter } from '../model/ProductFilter';
import type { ProductFacetOption, ProductFilterFacets } from '../model/ProductFacet';

export interface ProductFilterProps {
  readonly value: ProductFilter;
  readonly onChange: (value: ProductFilter) => void;
  readonly onApply: () => void;
  readonly onReset: () => void;
  readonly onColumns: () => void;
  readonly facets?: ProductFilterFacets;
  readonly facetsLoading: boolean;
  readonly facetsError?: string;
  readonly onRetryFacets: () => void;
}

export function ProductFilterForm({ value, onChange, onApply, onReset, onColumns, facets, facetsLoading, facetsError, onRetryFacets }: ProductFilterProps) {
  const facetCount = facets === undefined ? 0 : facets.categories.length + facets.suppliers.length + facets.malls.length + facets.statuses.length;
  return (
    <Form
      className="producttoolbar"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <TextField className="productsearchfield">
        <Label className="sr-only">商品搜索</Label>
        <ProductIcon name="search" />
        <Input value={value.q} onChange={(event) => onChange({ ...value, q: event.target.value })} maxLength={200} placeholder="搜索商品名称或规格编码" />
        <Button className="productsearchsubmit" tone="quiet" type="submit" aria-label="筛选">
          <ProductIcon name="arrowRight" />
        </Button>
      </TextField>

      <FacetSelect label="分类" value={value.category} options={facets?.categories ?? []} onChange={(category) => onChange({ ...value, category })} />
      <FacetSelect label="供应商" value={value.supplier} options={facets?.suppliers ?? []} onChange={(supplier) => onChange({ ...value, supplier })} />
      <FacetSelect label="商城范围" value={value.mall} options={facets?.malls ?? []} onChange={(mall) => onChange({ ...value, mall })} />
      <FacetSelect label="状态" value={value.status} options={facets?.statuses ?? []} onChange={(status) => onChange({ ...value, status })} />

      {facetsLoading ? (
        <span className="productfacetstate" role="status">
          正在加载筛选项…
        </span>
      ) : null}
      {!facetsLoading && facetsError !== undefined ? (
        <Button className="productfacetretry" tone="quiet" onPress={onRetryFacets}>
          筛选项加载失败，重试
        </Button>
      ) : null}
      {!facetsLoading && facetsError === undefined && facets !== undefined && facetCount === 0 ? <span className="productfacetstate">当前范围暂无可用筛选项</span> : null}

      <Button className="productreset" tone="quiet" onPress={onReset}>
        重置
      </Button>
      <span className="producttoolspacer" />
      <Button className="producttoolbutton" onPress={onColumns}>
        <ProductIcon name="settings" />
        列设置
      </Button>
    </Form>
  );
}

interface FacetSelectProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly ProductFacetOption[];
  readonly onChange: (value: string) => void;
}

function FacetSelect({ label, value, options, onChange }: FacetSelectProps) {
  if (options.length === 0 && value === '') return null;
  const choices = options.some((option) => option.value === value) || value === '' ? options : [Object.freeze({ value, label: `已选${label}`, count: 0 }), ...options];
  return (
    <label className="productselectcontrol">
      <span className="sr-only">{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{label}</option>
        {choices.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}（{option.count}）
          </option>
        ))}
      </select>
      <ProductIcon name="chevron" />
    </label>
  );
}
