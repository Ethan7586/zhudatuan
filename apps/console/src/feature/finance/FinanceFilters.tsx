import { zodResolver } from '@hookform/resolvers/zod';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { FinanceIcon } from './FinanceIcon';
import { FinanceFilterSchema, type FinanceFilter } from './FinanceWorkspaceSchema';

export const emptyFinanceFilter: FinanceFilter = Object.freeze({ q: '', period: '', channel: '', mall: '', status: '', difference: '' });
export function FinanceFilters({
  value,
  columnsOpen,
  onApply,
  onColumns,
}: Readonly<{
  value: FinanceFilter;
  columnsOpen: boolean;
  onApply: (value: FinanceFilter) => void;
  onColumns: () => void;
}>) {
  const form = useForm<FinanceFilter>({ resolver: zodResolver(FinanceFilterSchema), values: value });
  const reset = () => {
    form.reset(emptyFinanceFilter);
    onApply(emptyFinanceFilter);
  };
  return (
    <Form
      className="financefilters"
      onSubmit={(event) => {
        void form.handleSubmit(onApply)(event);
      }}
    >
      <TextField className="financesearchfield">
        <Label className="sr-only">搜索对账记录</Label>
        <FinanceIcon name="search" />
        <Input {...form.register('q')} disabled placeholder="搜索批次号、订单号、支付单号或渠道流水" aria-describedby="financefilterboundary" />
      </TextField>
      <FilterSelect label="账期" registration={form.register('period')} />
      <FilterSelect label="支付渠道" registration={form.register('channel')} />
      <FilterSelect label="商城范围" registration={form.register('mall')} />
      <FilterSelect label="对账状态" registration={form.register('status')} />
      <FilterSelect label="差异类型" registration={form.register('difference')} />
      <button className="financefilterbutton" type="button" disabled>
        <FinanceIcon name="filter" />
        更多筛选
        <FinanceIcon name="chevron" />
      </button>
      <button className="financeresetbutton" type="button" onClick={reset}>
        重置
      </button>
      <span className="financefilterspacer" />
      <button className="financefilterbutton" type="button" onClick={onColumns} aria-expanded={columnsOpen} aria-controls="financecolumnsettings">
        <FinanceIcon name="settings" />
        列设置
      </button>
      <button className="sr-only" type="submit">
        应用筛选
      </button>
      <p id="financefilterboundary" className="sr-only">
        生产合同没有这些服务端筛选能力，控件保持不可用。
      </p>
    </Form>
  );
}

function FilterSelect({
  label,
  registration,
}: Readonly<{
  label: string;
  registration: UseFormRegisterReturn;
}>) {
  return (
    <label className="financeselect" title={`${label}等待服务端筛选合同`}>
      <span className="sr-only">{label}</span>
      <select {...registration} disabled aria-describedby="financefilterboundary">
        <option value="">{label}</option>
      </select>
      <FinanceIcon name="chevron" />
    </label>
  );
}
