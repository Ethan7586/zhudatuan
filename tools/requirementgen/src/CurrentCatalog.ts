import type { DeliveryStatus } from './DeliveryStatus';
import type { CurrentFunctionTrace } from './CurrentTrace';

export interface FunctionalRequirement extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly source: Readonly<{ sheet: string; row: number; columns: readonly string[] }>;
  readonly section: string;
  readonly title: string;
  readonly description: string;
  readonly status: DeliveryStatus;
  readonly disposition: 'InScope' | 'NotRequired';
  readonly owner: string;
  readonly capability: string;
  readonly handler: string;
  readonly tableOrProjection: string;
  readonly clients: readonly string[];
  readonly uiRoutes: readonly string[];
  readonly routePaths: readonly string[];
  readonly tests: readonly string[];
  readonly jobs: readonly string[];
}

export interface MvpCatalogRecord extends Readonly<Record<string, unknown>> {
  readonly id: string;
  readonly row: number;
  readonly title: string;
  readonly status: DeliveryStatus;
  readonly release: 'blocking';
  readonly modules: readonly string[];
  readonly operations: readonly string[];
  readonly routes: readonly string[];
  readonly journeys: readonly string[];
  readonly jobs: readonly string[];
  readonly runbook: string;
  readonly releaseEvidence: string;
}

export interface RequirementCoverage {
  readonly modules: Readonly<{ count: number; ids: readonly string[] }>;
  readonly clients: Readonly<{ count: number; ids: readonly string[] }>;
  readonly richVoucherOperations: number;
  readonly approvalOperations: number;
  readonly runtimeImportOperations: number;
  readonly journeys: number;
}

export function currentCatalog(
  authority: Readonly<{ path: string; sheet: string; range: string; sha256: string; readAt: string }>,
  coverage: RequirementCoverage,
  requirements: readonly FunctionalRequirement[],
  mvp: readonly MvpCatalogRecord[],
  current: Readonly<{ path: string; sha256: string; commit: string; records: readonly CurrentFunctionTrace[] }>
): string {
  const lines = [
    '# 当前代码业务功能清单（2026-09-04 口径）',
    '',
    '> 本文件由 `tools/requirementgen` 从权威工作簿、Operation、Route、Handler、Job、Journey 和发布证据生成，请勿手改。',
    `> 工作簿：\`${authority.path}\`，工作表：\`${authority.sheet}\`，范围：\`${authority.range}\`，SHA-256：\`${authority.sha256}\`，复核日期：\`${authority.readAt}\`。`,
    '> 代码存在只会推进到 `Implemented`；只有自动验收证据和签名发布证据才能推进到 `Verified`、`Released`。',
    '',
    '## 1. 覆盖总览',
    '',
    '| 项目 | 可复核结果 |',
    '| --- | --- |',
    `| 业务与运行模块 | ${coverage.modules.count}：${coverage.modules.ids.map(code).join('、')} |`,
    `| 产品客户端 | ${coverage.clients.count}：${coverage.clients.ids.map(code).join('、')} |`,
    `| Rich Voucher Operation | ${coverage.richVoucherOperations} |`,
    `| Approval Operation | ${coverage.approvalOperations} |`,
    `| Runtime Import Operation | ${coverage.runtimeImportOperations} |`,
    `| 端到端旅程 | ${coverage.journeys} |`,
    `| 工作簿业务项 | ${requirements.length} |`,
    `| MVP 发布阻断项 | ${mvp.length} |`,
    `| LI 当前功能逐行归并 | ${current.records.length} |`,
    '',
    '## 2. MVP 发布阻断清单',
    '',
    '| 坐标 / ID | 主题 | 证据计算状态 | 模块 | Route | Operation | Journey | Job | Runbook | 签名发布证据 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...mvp.map((record) =>
      row([
        `A${record.row}:F${record.row} ${code(record.id)}`,
        record.title,
        record.status,
        list(record.modules),
        list(record.routes),
        list(record.operations),
        list(record.journeys),
        list(record.jobs),
        code(record.runbook),
        code(record.releaseEvidence),
      ])
    ),
    '',
    '## 3. 全量业务功能与代码落点',
    '',
  ];
  for (const [sheet, records] of grouped(requirements)) {
    lines.push(
      `### ${escape(sheet)}`,
      '',
      '| 来源 / ID | 功能 | 说明 | 归并结果 | 客户端 / Route | Operation / Handler | 数据 / Job | 自动化证据 |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ...records.map((record) =>
        row([
          `${escape(record.source.sheet)}!A${record.source.row}:D${record.source.row} ${code(record.id)}`,
          record.title,
          record.description,
          record.disposition === 'NotRequired' ? '已裁决删除' : record.status,
          `${list(record.clients)}<br>${list(record.uiRoutes)}<br>${list(record.routePaths)}`,
          `${code(record.capability)}<br>${code(record.handler)}`,
          `${code(record.tableOrProjection)}<br>${list(record.jobs)}`,
          list(record.tests),
        ])
      ),
      ''
    );
  }
  lines.push(
    '## 4. zhudatuan_li 当前功能逐行归并',
    '',
    `> 来源：\`${current.path}\`，Commit：\`${current.commit}\`，SHA-256：\`${current.sha256}\`。来源状态只作历史证据，不作为生产发布状态。`,
    '> `Retained/Connected/Completed/Unified/Implemented/Replaced` 是迁移处置；代码证据状态由 Route、Operation、Handler、Data Object、Event/Job、Journey 和 Runbook 自动计算。',
    ''
  );
  for (const [section, records] of groupedCurrent(current.records)) {
    lines.push(
      `### ${escape(section)} ${escape(records[0]!.source.heading)}`,
      '',
      '| 来源 / ID | 功能语义 | 历史状态 | 归并处置 / 证据状态 | 模块 / Route | 主 Operation / Handler | 数据 / Event / Job | Journey / Runbook |',
      '| --- | --- | --- | --- | --- | --- | --- | --- |',
      ...records.map((record) =>
        row([
          `L${record.source.line} ${code(record.id)}`,
          `${record.source.qualifier ? `【${record.source.qualifier}】` : ''}${record.source.text}`,
          record.source.status,
          `${record.disposition}<br>${record.deliveryStatus}`,
          `${list(record.modules)}<br>${list(record.routes.map(({ id, path }) => `${id} ${path}`))}`,
          `${code(record.primaryOperation)}<br>${code(record.primaryHandler)}`,
          `${list(record.dataObjects.map(({ id }) => id))}<br>${list(record.ports)}<br>${list(record.events.map(({ id }) => id))}<br>${list(record.jobs.map(({ id }) => id))}`,
          `${list(record.journeys.map(({ id }) => id))}<br>${list(record.runbooks)}`,
        ])
      ),
      ''
    );
  }
  lines.push(
    '## 5. 状态与发布边界',
    '',
    '- `Designed`：合同或设计存在，代码证据链仍有缺口。',
    '- `Implemented`：Route、Operation、Handler、数据落点和代码级测试文件齐备；不代表跨模块或真实环境已通过。',
    '- `Integrated`：真实依赖、权限、持久化、异步任务和错误恢复证据齐备。',
    '- `Verified`：旅程、视觉、可访问性、性能、安全和数据核对证据全部通过。',
    '- `Released`：生产配置、迁移、监控、回滚和负责人签名证据与同一制品绑定。',
    '- `已裁决删除`：权威来源明确不需要，生产导航、DOM、合同和运行时均不得残留。',
    ''
  );
  return lines.join('\n');
}

function grouped(requirements: readonly FunctionalRequirement[]): readonly [string, readonly FunctionalRequirement[]][] {
  const groups = new Map<string, FunctionalRequirement[]>();
  for (const requirement of requirements) groups.set(requirement.source.sheet, [...(groups.get(requirement.source.sheet) ?? []), requirement]);
  return [...groups.entries()];
}

function groupedCurrent(records: readonly CurrentFunctionTrace[]): readonly [string, readonly CurrentFunctionTrace[]][] {
  const groups = new Map<string, CurrentFunctionTrace[]>();
  for (const record of records) groups.set(record.source.section, [...(groups.get(record.source.section) ?? []), record]);
  return [...groups.entries()];
}

function row(values: readonly string[]): string {
  return `| ${values.map(escape).join(' | ')} |`;
}

function list(values: readonly string[]): string {
  return values.length === 0 ? '—' : values.map(code).join('<br>');
}

function code(value: string): string {
  return `\`${escape(value)}\``;
}

function escape(value: string): string {
  return String(value).replaceAll('|', '\\|').replaceAll('\r\n', '<br>').replaceAll('\n', '<br>');
}
