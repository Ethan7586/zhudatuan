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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
  previewEnabled,
=======
  enabled,
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  onPatch: (value: Partial<FinanceFilter>) => void;
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
  previewEnabled,
  facets,
  columnsOpen,
  onApply,
  onColumns,
}: Readonly<{
  value: FinanceFilter;
  previewEnabled: boolean;
  facets: FinanceFacets | undefined;
  columnsOpen: boolean;
  onApply: (value: FinanceFilter) => void;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    onPatch(patch);
=======
    onApply(next);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
    onPatch(patch);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
    onApply(next);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
          <Input {...form.register('q')} disabled={!enabled} placeholder="搜索批次号、订单号、支付单号或渠道流水" aria-describedby="financefilterboundary" />
        </TextField>
        <FilterSelect label="账期" disabled={!enabled} options={options(facets?.periods)} {...select('period')} />
        <FilterSelect label="支付渠道" disabled={!enabled} options={options(facets?.channels)} {...select('channel')} />
        <FilterSelect label="商城范围" disabled={!enabled} options={options(facets?.malls)} {...select('mall')} />
        <FilterSelect label="对账状态" disabled={!enabled} options={options(facets?.statuses)} {...select('status')} />
        <FilterSelect label="差异类型" disabled={!enabled} options={options(facets?.differenceTypes)} {...select('difference')} />
        <button className="financefilterbutton" type="button" disabled={!enabled} onClick={() => setMoreOpen(true)}>
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
          <Input {...form.register('q')} disabled={!previewEnabled} placeholder="搜索批次号、订单号、支付单号或渠道流水" aria-describedby="financefilterboundary" />
        </TextField>
        <FilterSelect label="账期" disabled={!previewEnabled} options={options(facets?.periods)} {...select('period')} />
        <FilterSelect label="支付渠道" disabled={!previewEnabled} options={options(facets?.channels)} {...select('channel')} />
        <FilterSelect label="商城范围" disabled={!previewEnabled} options={options(facets?.malls)} {...select('mall')} />
        <FilterSelect label="对账状态" disabled={!previewEnabled} options={options(facets?.statuses)} {...select('status')} />
        <FilterSelect label="差异类型" disabled={!previewEnabled} options={options(facets?.differenceTypes)} {...select('difference')} />
        <button className="financefilterbutton" type="button" disabled={!previewEnabled} onClick={() => setMoreOpen(true)}>
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          <Input {...form.register('q')} disabled={!enabled} placeholder="搜索批次号、订单号、支付单号或渠道流水" aria-describedby="financefilterboundary" />
        </TextField>
        <FilterSelect label="账期" disabled={!enabled} options={options(facets?.periods)} {...select('period')} />
        <FilterSelect label="支付渠道" disabled={!enabled} options={options(facets?.channels)} {...select('channel')} />
        <FilterSelect label="商城范围" disabled={!enabled} options={options(facets?.malls)} {...select('mall')} />
        <FilterSelect label="对账状态" disabled={!enabled} options={options(facets?.statuses)} {...select('status')} />
        <FilterSelect label="差异类型" disabled={!enabled} options={options(facets?.differenceTypes)} {...select('difference')} />
        <button className="financefilterbutton" type="button" disabled={!enabled} onClick={() => setMoreOpen(true)}>
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
          筛选条件提交至服务端权威读模型；浏览器不对当前页面数据冒充全量筛选。
=======
          生产合同没有这些服务端筛选能力；控件仅在隔离的本地预览范围启用。
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          筛选条件提交至服务端权威读模型；浏览器不对当前页面数据冒充全量筛选。
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
          生产合同没有这些服务端筛选能力；控件仅在隔离的本地预览范围启用。
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        </p>
      </Form>
      <Dialog open={moreOpen} title="更多筛选" onClose={() => setMoreOpen(false)}>
        <div className="financemorefilters">
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
          <p>快捷条件由服务端筛选，不会对当前 DOM 行做全量统计。</p>
=======
          <p>快捷条件仍由本地预览服务端筛选，不会对当前 DOM 行做全量统计。</p>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          <p>快捷条件由服务端筛选，不会对当前 DOM 行做全量统计。</p>
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
          <p>快捷条件仍由本地预览服务端筛选，不会对当前 DOM 行做全量统计。</p>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
          void registration.onChange(event);
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          void registration.onChange(event);
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
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
