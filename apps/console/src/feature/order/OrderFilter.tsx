import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { useForm } from 'react-hook-form';
import { OrderIcon } from './OrderIcon';
import { OrderListFilterSchema, type OrderListFilter } from './OrderSchema';

export interface OrderFilterProps {
  readonly value: OrderListFilter;
  readonly onApply: (value: OrderListFilter) => void;
  readonly onColumns: () => void;
  readonly columnsOpen: boolean;
}

export const emptyOrderFilter: OrderListFilter = Object.freeze({
  order: '',
});

export function OrderFilterForm({ value, onApply, onColumns, columnsOpen }: OrderFilterProps) {
  const form = useForm<OrderListFilter>({ resolver: zodResolver(OrderListFilterSchema), values: value });
  const reset = () => {
    form.reset(emptyOrderFilter);
    onApply(emptyOrderFilter);
  };
  return (
    <Form
      className="ordertoolbar"
      onSubmit={(event) => {
        void form.handleSubmit(onApply)(event);
      }}
    >
      <TextField className="ordersearchfield">
        <Label className="sr-only">订单搜索</Label>
        <OrderIcon name="search" />
        <Input {...form.register('order')} placeholder="输入内部订单编号" />
        <button className="ordersearchsubmit" type="submit" aria-label="筛选订单">
          <OrderIcon name="arrowRight" />
        </button>
      </TextField>

      <button className="orderreset" type="button" onClick={reset}>
        重置
      </button>
      <span className="ordertoolspacer" />
      <button className="ordertoolbutton" type="button" onClick={onColumns} aria-expanded={columnsOpen} aria-controls="ordercolumnsettings">
        <OrderIcon name="settings" />
        列设置
      </button>
    </Form>
  );
}
