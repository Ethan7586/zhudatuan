import { Button, DataTable, ResourcePanel, type DataColumn } from '@shop/design';
import { chineseDomainLabel, chineseSectionLabel } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { ControlContentViewModel, ControlViewModel, RuntimeRow } from '../viewmodel/ControlViewModel';
import './Control.css';

type PlatformRow = Extract<ControlContentViewModel, { kind: 'platform' }>['rows'][number];
type DistributionRow = Extract<ControlContentViewModel, { kind: 'distribution' }>['rows'][number];
const platformColumns: readonly DataColumn<PlatformRow>[] = Object.freeze([
  { key: 'name', label: '组织', render: (row) => row.name },
  { key: 'kind', label: '层级', render: (row) => chineseDomainLabel(row.kind) },
  { key: 'parent', label: '上级组织', render: (row) => (row.parentId === null ? '顶层组织' : (row.parentName ?? '上级组织名称不可用')) },
  { key: 'timezone', label: '时区', render: (row) => chineseDomainLabel(row.timezone, '其他时区') },
  { key: 'status', label: '状态', render: (row) => <HealthState value={chineseDomainLabel(row.status)} healthy={row.status === 'active'} /> },
  { key: 'version', label: '版本', render: (row) => `第 ${row.version} 版` },
]);
const distributionColumns: readonly DataColumn<DistributionRow>[] = Object.freeze([
  { key: 'name', label: '分销商', render: (row) => row.name },
  { key: 'code', label: '分销商编码', render: (row) => row.code },
  { key: 'settlement', label: '结算模式', render: (row) => chineseDomainLabel(row.settlementMode) },
  { key: 'tenants', label: '租户数', render: (row) => row.tenantCount },
  { key: 'status', label: '状态', render: (row) => <HealthState value={chineseDomainLabel(row.status)} healthy={row.status === 'active'} /> },
  { key: 'updated', label: '更新时间', render: (row) => formatDate(row.updatedAt) },
]);
const runtimeColumns: readonly DataColumn<RuntimeRow>[] = Object.freeze([
  { key: 'subsystem', label: '子系统', render: (row) => row.subsystem },
  { key: 'status', label: '状态', render: (row) => <HealthState value={row.status} healthy={row.status === '正常' || row.status === '可用' || row.status === '一致'} /> },
  { key: 'detail', label: '权威读数', render: (row) => row.detail },
]);

export function ControlPage({ title, model }: Readonly<{ title: string; model: ControlViewModel }>) {
  if (model.needsStepup) return <ControlAssurance title={title} onStepup={model.actions.stepup} />;
  const error = model.error === undefined ? {} : { error: model.error };
  return (
    <div className="controlworkspace">
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel(model.eyebrow)}
        description={model.description}
        condition={model.condition}
        {...error}
        retry={model.actions.refresh}
        actions={
          <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
            {model.fetching ? '正在刷新…' : '刷新'}
          </Button>
        }
      >
        {model.content ? (
          <section className="controlpanel">
            <ControlTable model={model.content} />
            <footer>
              <span>本页 {model.content.count} 条</span>
              <div>
                {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                {'nextCursor' in model.content && model.content.nextCursor ? <Button onPress={() => model.actions.next(model.content?.kind === 'runtime' ? '' : (model.content?.nextCursor ?? ''))}>下一页</Button> : null}
              </div>
            </footer>
          </section>
        ) : null}
      </ResourcePanel>
    </div>
  );
}

function ControlTable({ model }: Readonly<{ model: ControlContentViewModel }>) {
  if (model.kind === 'platform') return <DataTable caption="平台层" columns={platformColumns} rows={model.rows} rowKey={(row) => row.id} />;
  if (model.kind === 'distribution') return <DataTable caption="分销层" columns={distributionColumns} rows={model.rows} rowKey={(row) => row.id} />;
  return <DataTable caption="系统运行状态" columns={runtimeColumns} rows={model.rows} rowKey={(row) => row.id} />;
}

function HealthState({ value, healthy }: Readonly<{ value: string; healthy: boolean }>) {
  return (
    <span className="controlstate" data-healthy={healthy}>
      {value}
    </span>
  );
}

function ControlAssurance({ title, onStepup }: Readonly<{ title: string; onStepup: () => void }>) {
  return (
    <section className="controlassurance" aria-labelledby="controlassurancetitle">
      <span aria-hidden="true">◇</span>
      <div>
        <p className="eyebrow">敏感数据保护</p>
        <h1 id="controlassurancetitle">{title}</h1>
        <p>运行状态包含数据库、任务队列与扩展健康信息。请完成短信二次验证后查看，成功后会自动返回当前数据范围。</p>
        <ul>
          <li>验证码仅用于确认本次操作人身份</li>
          <li>页面不保存验证码或操作凭证</li>
          <li>验证完成后按当前 Scope 权威重读</li>
        </ul>
        <Button tone="primary" onPress={onStepup}>
          立即完成二次验证
        </Button>
      </div>
    </section>
  );
}
