import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { useForm, type UseFormRegister } from 'react-hook-form';
import { EMPTY_ORDER_LIST_FILTER, OrderListFilterSchema, type OrderListFilter } from '../model/OrderFilter';
import { OrderIcon } from './OrderIcon';

export interface OrderFilterProps {
  readonly value: OrderListFilter;
  readonly malls: readonly Readonly<{ id: string; label: string }>[];
  readonly onApply: (value: OrderListFilter) => void;
  readonly onColumns: () => void;
  readonly columnsOpen: boolean;
}

const filters = {
  placed: [
    ['', '全部时间'],
    ['today', '今天'],
    ['7days', '近 7 天'],
    ['30days', '近 30 天'],
  ],
  lifecycle: [
    ['', '全部进度'],
    ['created', '已创建'],
    ['awaitingpayment', '等待付款'],
    ['paid', '已付款'],
    ['fulfilling', '履约中'],
    ['shipped', '已发货'],
    ['received', '已收货'],
    ['completed', '已完成'],
    ['cancelled', '已取消'],
  ],
  payment: [
    ['', '全部支付状态'],
    ['unpaid', '未付款'],
    ['authorizing', '付款确认中'],
    ['paid', '已付款'],
    ['partially_refunded', '部分退款'],
    ['refunded', '已退款'],
    ['failed', '付款失败'],
  ],
  fulfillment: [
    ['', '全部履约状态'],
    ['unallocated', '待分配'],
    ['allocated', '已分配'],
    ['processing', '备货中'],
    ['shipped', '已发货'],
    ['delivered', '已送达'],
    ['received', '已收货'],
    ['cancelled', '已取消'],
    ['returned', '已退回'],
  ],
} as const;

export function OrderFilterForm({ value, malls, onApply, onColumns, columnsOpen }: OrderFilterProps) {
  const form = useForm<OrderListFilter>({ resolver: zodResolver(OrderListFilterSchema), values: value });
  const reset = () => {
    form.reset(EMPTY_ORDER_LIST_FILTER);
    onApply(EMPTY_ORDER_LIST_FILTER);
  };
  return (
    <Form
      className="ordertoolbar"
      onSubmit={(event) => {
        void form.handleSubmit(onApply)(event);
      }}
    >
      <TextField className="ordersearchfield" aria-describedby="ordersearchhelp">
        <Label className="sr-only">订单搜索</Label>
        <OrderIcon name="search" />
        <Input {...form.register('search')} placeholder="订单号、外部单号、商品或会员" />
        <button className="ordersearchsubmit" type="submit" aria-label="筛选订单">
          <OrderIcon name="arrowRight" />
        </button>
      </TextField>
      <span id="ordersearchhelp" className="sr-only">优先使用业务订单号；技术编号仅用于高级排障，不会作为列表主标题。</span>

      <Select label="下单时间" name="placed" register={form.register} options={filters.placed} />
      <Select label="订单进度" name="lifecycle" register={form.register} options={filters.lifecycle} />
      <Select label="支付状态" name="payment" register={form.register} options={filters.payment} />
      <Select label="履约状态" name="fulfillment" register={form.register} options={filters.fulfillment} />
      <label className="orderselectcontrol">
        <span className="sr-only">所属商城</span>
        <select aria-label="所属商城" {...form.register('mall')}>
          <option value="">全部商城</option>
          {malls.map((mall) => (
            <option key={mall.id} value={mall.id}>
              {mall.label}
            </option>
          ))}
        </select>
        <OrderIcon name="chevron" />
      </label>

      <details className="orderadvancedfilter">
        <summary>更多条件</summary>
        <div>
          <label>起始时间<input type="datetime-local" {...form.register('from')} /></label>
          <label>结束时间<input type="datetime-local" {...form.register('to')} /></label>
          <label>来源渠道<input {...form.register('channel')} placeholder="输入渠道名称" /></label>
          <label>商品<input {...form.register('product')} placeholder="商品名称或规格编号" /></label>
          <label>成员<input {...form.register('member')} placeholder="姓名、工号、手机号或邮箱" /></label>
          <label>最低金额（分）<input inputMode="numeric" {...form.register('minimumMinor')} /></label>
          <label>最高金额（分）<input inputMode="numeric" {...form.register('maximumMinor')} /></label>
        </div>
      </details>

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

function Select({
  label,
  name,
  register,
  options,
}: Readonly<{
  label: string;
  name: 'placed' | 'lifecycle' | 'payment' | 'fulfillment';
  register: UseFormRegister<OrderListFilter>;
  options: readonly (readonly [string, string])[];
}>) {
  return (
    <label className="orderselectcontrol">
      <span className="sr-only">{label}</span>
      <select aria-label={label} {...register(name)}>
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
