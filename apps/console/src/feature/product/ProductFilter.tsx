import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { ProductIcon } from './ProductIcon';
import { ProductFilterSchema, type ProductFilter } from './ProductSchema';

export interface ProductFilterProps {
  readonly value: ProductFilter;
  readonly onApply: (value: ProductFilter) => void;
  readonly onColumns: () => void;
}

const emptyFilter: ProductFilter = Object.freeze({ q: '', category: '', supplier: '', mall: '', status: '' });

export function ProductFilterForm({ value, onApply, onColumns }: ProductFilterProps) {
  const form = useForm<ProductFilter>({ resolver: zodResolver(ProductFilterSchema), values: value });
  const reset = () => {
    form.reset(emptyFilter);
    onApply(emptyFilter);
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
        <Input {...form.register('q')} placeholder="搜索商品名称或 SKU" />
        <button className="productsearchsubmit" type="submit" aria-label="筛选">
          <ProductIcon name="arrowRight" />
        </button>
      </TextField>

      <TextField className="productcompactfield">
        <Label className="sr-only">分类编号</Label>
        <Input {...form.register('category')} placeholder="分类编号" />
      </TextField>

      <UnsupportedSelect label="供应商" registration={form.register('supplier')} />
      <UnsupportedSelect label="商城范围" registration={form.register('mall')} />
      <UnsupportedSelect label="状态" registration={form.register('status')} />

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
      <p id="productfilterboundary" className="sr-only">
        供应商、商城范围和状态筛选尚未包含在生产列表合同中。
      </p>
    </Form>
  );
}

interface UnsupportedSelectProps {
  readonly label: string;
  readonly registration: UseFormRegisterReturn;
}

function UnsupportedSelect({ label, registration }: UnsupportedSelectProps) {
  return (
    <label className="productselectcontrol" title={`${label}筛选等待服务端合同`}>
      <span className="sr-only">{label}</span>
      <select {...registration} disabled aria-describedby="productfilterboundary">
        <option value="">{label}</option>
      </select>
      <ProductIcon name="chevron" />
    </label>
  );
}
