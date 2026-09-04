import { DataTable, type DataColumn } from '@shop/design';
import { formatDate } from '../../../shared/ui/Format';
import type { ControlContentViewModel, RuntimeRow } from '../viewmodel/ControlViewModel';
import { ControlState } from './ControlState';

type RuntimeContent = Extract<ControlContentViewModel, { kind: 'runtime' }>;

const columns: readonly DataColumn<RuntimeRow>[] = Object.freeze([
  { key: 'source', label: '权威来源', render: (row) => row.source },
  { key: 'subsystem', label: '检查项', render: (row) => row.subsystem },
  { key: 'status', label: '状态', render: (row) => <ControlState value={row.status} healthy={row.healthy} /> },
  { key: 'detail', label: '权威读数', render: (row) => row.detail },
]);

export function RuntimeControl({ model }: Readonly<{ model: RuntimeContent }>) {
  return (
    <div className="runtimecontrol">
      <section className="controlmetrics" aria-label="平台健康摘要">
        {model.metrics.map((metric) => (
          <article key={metric.label} data-healthy={metric.healthy}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </article>
        ))}
      </section>
      <p className="controlwatermark">观测时间：{formatDate(model.observedAt)} · 数据由能力、扩展、风险与可观测性服务提供</p>
      <DataTable caption="平台健康与能力状态" columns={columns} rows={model.rows} rowKey={(row) => row.id} />
    </div>
  );
}
