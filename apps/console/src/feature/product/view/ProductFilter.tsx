import { Form, Input, Label, TextField } from 'react-aria-components';
import { ProductIcon } from './ProductIcon';
import type { ProductFilter } from '../model/ProductFilter';

export interface ProductFilterProps {
  readonly value: ProductFilter;
  readonly onChange: (value: ProductFilter) => void;
  readonly onApply: () => void;
  readonly onReset: () => void;
  readonly onColumns: () => void;
}

export function ProductFilterForm({ value, onChange, onApply, onReset, onColumns }: ProductFilterProps) {
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
        <button className="productsearchsubmit" type="submit" aria-label="筛选">
          <ProductIcon name="arrowRight" />
        </button>
      </TextField>

      <TextField className="productcompactfield">
        <Label className="sr-only">分类编号</Label>
        <Input value={value.category} onChange={(event) => onChange({ ...value, category: event.target.value })} maxLength={200} placeholder="分类编号" />
      </TextField>

      <button className="productreset" type="button" onClick={onReset}>
        重置
      </button>
      <span className="producttoolspacer" />
      <button className="producttoolbutton" type="button" onClick={onColumns}>
        <ProductIcon name="settings" />
        列设置
      </button>
    </Form>
  );
}
