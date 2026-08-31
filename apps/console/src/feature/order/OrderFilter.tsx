import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
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
        <Input {...form.register('order')} aria-describedby="orderfilterboundary" placeholder="精确输入内部订单 ID" />
        <button className="ordersearchsubmit" type="submit" aria-label="筛选订单">
          <OrderIcon name="arrowRight" />
        </button>
      </TextField>

      <ContractSelect
        label="下单时间"
        disabled
        registration={form.register('placed')}
        options={[
          ['today', '今天'],
          ['7days', '近 7 天'],
          ['30days', '近 30 天'],
        ]}
      />
      <ContractSelect
        label="订单状态"
        disabled
        registration={form.register('lifecycle')}
        options={[
          ['created', '已创建'],
          ['active', '进行中'],
          ['completed', '已完成'],
          ['cancelled', '已取消'],
          ['closed', '已关闭'],
        ]}
      />
      <ContractSelect
        label="支付状态"
        disabled
        registration={form.register('payment')}
        options={[
          ['unpaid', '待付款'],
          ['paid', '已支付'],
          ['partially_refunded', '部分退款'],
          ['refunded', '已退款'],
          ['failed', '支付失败'],
        ]}
      />
      <ContractSelect
        label="履约状态"
        disabled
        registration={form.register('fulfillment')}
        options={[
          ['unallocated', '待分配'],
          ['allocated', '待发货'],
          ['processing', '履约中'],
          ['shipped', '已发货'],
          ['delivered', '已完成'],
        ]}
      />
      <ContractSelect
        label="商城范围"
        disabled
        registration={form.register('mall')}
        options={[
          ['huimin', '鸿泰惠民通'],
          ['zhenxuan', '鸿泰甄选'],
        ]}
      />

      <button className="ordertoolbutton" type="button" disabled title="等待服务端更多筛选合同" aria-describedby="orderfilterboundary">
        <OrderIcon name="filter" />
        更多筛选
        <OrderIcon name="chevron" />
      </button>
      <button className="orderreset" type="button" onClick={reset}>
        重置
      </button>
      <span className="ordertoolspacer" />
      <button className="ordertoolbutton" type="button" onClick={onColumns} aria-expanded={columnsOpen} aria-controls="ordercolumnsettings">
        <OrderIcon name="settings" />
        列设置
      </button>
      <p id="orderfilterboundary" className="sr-only">
        当前生产订单合同只支持内部订单 ID 精确筛选；时间、状态、支付、履约和商城筛选尚未接入服务端，当前保持不可用。
      </p>
    </Form>
  );
}

interface ContractSelectProps {
  readonly label: string;
  readonly disabled: boolean;
  readonly registration: UseFormRegisterReturn;
  readonly options: readonly (readonly [string, string])[];
}

function ContractSelect({ label, disabled, registration, options }: ContractSelectProps) {
  return (
    <label className="orderselectcontrol" title={disabled ? `${label}筛选等待服务端合同` : undefined}>
      <span className="sr-only">{label}</span>
      <select {...registration} disabled={disabled} aria-describedby={disabled ? 'orderfilterboundary' : undefined}>
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
