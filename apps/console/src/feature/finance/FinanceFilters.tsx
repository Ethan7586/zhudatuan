import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog } from '@shop/design';
import { Form, Input, Label, TextField } from 'react-aria-components';
import { useState } from 'react';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { FinanceIcon } from './FinanceIcon';
import { FinanceFilterSchema, type FinanceFilter, type FinanceReconciliationPage } from './FinanceWorkspaceSchema';

export const emptyFinanceFilter: FinanceFilter = Object.freeze({ q: '', period: '', channel: '', mall: '', status: '', difference: '' });
type FinanceFacets = NonNullable<FinanceReconciliationPage['preview']>['facets'];

export function FinanceFilters({
  value,
  enabled,
  facets,
  columnsOpen,
  onApply,
  onPatch,
  onColumns,
}: Readonly<{
  value: FinanceFilter;
  enabled: boolean;
  facets: FinanceFacets | undefined;
  columnsOpen: boolean;
  onApply: (value: FinanceFilter) => void;
  onPatch: (value: Partial<FinanceFilter>) => void;
  onColumns: () => void;
}>) {
  const form = useForm<FinanceFilter>({ resolver: zodResolver(FinanceFilterSchema), values: value });
  const [moreOpen, setMoreOpen] = useState(false);
  const reset = () => {
    form.reset(emptyFinanceFilter);
    onApply(emptyFinanceFilter);
  };
  const applyPatch = (patch: Partial<FinanceFilter>) => {
    const next = FinanceFilterSchema.parse({ ...form.getValues(), ...patch });
    form.reset(next);
    onPatch(patch);
  };
  const select = (key: Exclude<keyof FinanceFilter, 'q'>) => ({
    registration: form.register(key),
    onValue: (value: string) => applyPatch({ [key]: value }),
  });
  return (
    <>
      <Form
        className="financefilters"
        onSubmit={(event) => {
          void form.handleSubmit(onApply)(event);
        }}
      >
        <TextField className="financesearchfield">
          <Label className="sr-only">搜索对账记录</Label>
          <FinanceIcon name="search" />
          <Input {...form.register('q')} disabled={!enabled} placeholder="搜索批次号、订单号、支付单号或渠道流水" aria-describedby="financefilterboundary" />
        </TextField>
        <FilterSelect label="账期" disabled={!enabled} options={options(facets?.periods)} {...select('period')} />
        <FilterSelect label="支付渠道" disabled={!enabled} options={options(facets?.channels)} {...select('channel')} />
        <FilterSelect label="商城范围" disabled={!enabled} options={options(facets?.malls)} {...select('mall')} />
        <FilterSelect label="对账状态" disabled={!enabled} options={options(facets?.statuses)} {...select('status')} />
        <FilterSelect label="差异类型" disabled={!enabled} options={options(facets?.differenceTypes)} {...select('difference')} />
        <button className="financefilterbutton" type="button" disabled={!enabled} onClick={() => setMoreOpen(true)}>
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
          筛选条件提交至服务端权威读模型；浏览器不对当前页面数据冒充全量筛选。
        </p>
      </Form>
      <Dialog open={moreOpen} title="更多筛选" onClose={() => setMoreOpen(false)}>
        <div className="financemorefilters">
          <p>快捷条件由服务端筛选，不会对当前 DOM 行做全量统计。</p>
          <Button
            onPress={() => {
              applyPatch({ status: 'difference' });
              setMoreOpen(false);
            }}
          >
            仅看差异待处理
          </Button>
          <Button
            onPress={() => {
              applyPatch({ status: 'pending-review' });
              setMoreOpen(false);
            }}
          >
            仅看等待复核
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function FilterSelect({
  label,
  disabled,
  registration,
  options: values,
  onValue,
}: Readonly<{
  label: string;
  disabled: boolean;
  registration: UseFormRegisterReturn;
  options: readonly (readonly [string, string])[];
  onValue: (value: string) => void;
}>) {
  return (
    <label className="financeselect" title={disabled ? `${label}等待服务端筛选合同` : undefined}>
      <span className="sr-only">{label}</span>
      <select
        {...registration}
        disabled={disabled}
        aria-describedby={disabled ? 'financefilterboundary' : undefined}
        onChange={(event) => {
          void registration.onChange(event);
          onValue(event.target.value);
        }}
      >
        <option value="">{label}</option>
        {values.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <FinanceIcon name="chevron" />
    </label>
  );
}

function options(facets: readonly Readonly<{ value: string; label: string }>[] | undefined): readonly (readonly [string, string])[] {
  return facets?.map((facet) => [facet.value, facet.label] as const) ?? [];
}
