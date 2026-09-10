import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Form, Input, Label, TextField } from 'react-aria-components';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { OrderIcon } from './OrderIcon';
import { OrderListFilterSchema, type OrderListFilter } from './OrderSchema';
import { OrderPreviewAction } from './OrderPreviewAction';

export interface OrderFilterProps {
  readonly value: OrderListFilter;
  readonly onApply: (value: OrderListFilter) => void;
  readonly onColumns: () => void;
  readonly columnsOpen: boolean;
}

export const emptyOrderFilter: OrderListFilter = Object.freeze({
  order: '',
  placed: '',
  lifecycle: '',
  payment: '',
  fulfillment: '',
  mall: '',
});

export function OrderFilterForm({ value, onApply, onColumns, columnsOpen }: OrderFilterProps) {
  const form = useForm<OrderListFilter>({ resolver: zodResolver(OrderListFilterSchema), values: value });
  const reset = () => {
    form.reset(emptyOrderFilter);
    onApply(emptyOrderFilter);
  };
  const applyQuickFilter = (patch: Partial<OrderListFilter>) => {
    const next = OrderListFilterSchema.parse({ ...form.getValues(), ...patch });
    form.reset(next);
    onApply(next);
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
        <Input {...form.register('order')} aria-describedby="orderfilterboundary" placeholder="输入订单号" />
        <button className="ordersearchsubmit" type="submit" aria-label="筛选订单">
          <OrderIcon name="arrowRight" />
        </button>
      </TextField>

      <FilterSelect
        label="下单时间"
        registration={form.register('placed')}
        options={[
          ['today', '今天'],
          ['7days', '近 7 天'],
          ['30days', '近 30 天'],
        ]}
      />
      <FilterSelect
        label="订单状态"
        registration={form.register('lifecycle')}
        options={[
          ['created', '已创建'],
          ['active', '进行中'],
          ['completed', '已完成'],
          ['cancelled', '已取消'],
          ['closed', '已关闭'],
        ]}
      />
      <FilterSelect
        label="支付状态"
        registration={form.register('payment')}
        options={[
          ['unpaid', '待付款'],
          ['paid', '已支付'],
          ['partially_refunded', '部分退款'],
          ['refunded', '已退款'],
          ['failed', '支付失败'],
        ]}
      />
      <FilterSelect
        label="履约状态"
        registration={form.register('fulfillment')}
        options={[
          ['unallocated', '待分配'],
          ['allocated', '待发货'],
          ['processing', '履约中'],
          ['shipped', '已发货'],
          ['delivered', '已完成'],
        ]}
      />
      <OrderPreviewAction
        ariaLabel="更多筛选"
        title="更多筛选"
        disabled={false}
        describedBy="orderfilterboundary"
        triggerClassName="ordertoolbutton"
        triggerTitle="打开快捷筛选"
        trigger={
          <>
            <OrderIcon name="filter" />
            更多筛选
            <OrderIcon name="chevron" />
          </>
        }
      >
        {(close) => (
          <div className="orderpreviewoptions">
            <Button
              type="button"
              onPress={() => {
                applyQuickFilter({ placed: '30days', payment: 'paid' });
                close();
              }}
            >
              近 30 天 · 已支付
            </Button>
            <Button
              type="button"
              onPress={() => {
                applyQuickFilter({ lifecycle: 'active', fulfillment: 'allocated' });
                close();
              }}
            >
              进行中 · 待发货
            </Button>
          </div>
        )}
      </OrderPreviewAction>
      <button className="orderreset" type="button" onClick={reset}>
        重置
      </button>
      <span className="ordertoolspacer" />
      <button className="ordertoolbutton" type="button" onClick={onColumns} aria-expanded={columnsOpen} aria-controls="ordercolumnsettings">
        <OrderIcon name="settings" />
        列设置
      </button>
      <p id="orderfilterboundary" className="sr-only">
        订单号、时间、订单状态、支付状态和履约状态均由服务端筛选；结果限定在当前授权节点范围内。
      </p>
    </Form>
  );
}

interface FilterSelectProps {
  readonly label: string;
  readonly registration: UseFormRegisterReturn;
  readonly options: readonly (readonly [string, string])[];
}

function FilterSelect({ label, registration, options }: FilterSelectProps) {
  return (
    <label className="orderselectcontrol">
      <span className="sr-only">{label}</span>
      <select {...registration} aria-describedby="orderfilterboundary">
        <option value="">{label}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <OrderIcon name="chevron" />
    </label>
  );
}
