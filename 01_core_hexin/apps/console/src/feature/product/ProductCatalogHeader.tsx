import type { CatalogPublicationFailure, CatalogPublicationTask, ListingPage } from './ProductSchema';
import { ProductIcon } from './ProductIcon';

interface ProductCatalogHeaderProps {
  readonly page?: ListingPage;
  readonly previewEnabled: boolean;
  readonly partnerWorkspace: boolean;
  readonly workspace: 'catalog' | 'selection';
  readonly onWorkspace: (workspace: 'catalog' | 'selection') => void;
  readonly status: string;
  readonly onStatus: (status: string) => void;
  readonly exportReady: boolean;
  readonly writeEnabled: boolean;
  readonly releaseDisabledReason?: string;
  readonly releasePending: boolean;
  readonly publicationTask?: CatalogPublicationTask;
  readonly releaseFeedback?: Readonly<{ tone: 'success' | 'error'; message: string }>;
  readonly onImport: () => void;
  readonly onCreate: () => void;
  readonly onExport: () => void;
  readonly onRelease: () => void;
  readonly onRetry: () => void;
}

const tabs = Object.freeze([
  { key: '', label: '全部商品' },
  { key: 'needs_attention', label: '待完善' },
  { key: 'pending_review', label: '待审核' },
  { key: 'published', label: '已上架' },
  { key: 'unpublished', label: '已下架' },
] as const);

export function ProductCatalogHeader({ page, previewEnabled, partnerWorkspace, workspace, onWorkspace, status, onStatus, exportReady, writeEnabled, releaseDisabledReason,
  releasePending, publicationTask, releaseFeedback, onImport, onCreate, onExport, onRelease, onRetry }: ProductCatalogHeaderProps) {
  const preview = previewEnabled && page?.preview?.kind === 'console-product-v1' ? page.preview : undefined;
  const coreTotal = preview === undefined ? page?.total_count : preview.facets.statuses.reduce((total, facet) => total + facet.count, 0) || preview.totalCount;
  const pendingReviewCount = page?.status_counts?.pending_review;
  const noPendingReview = releaseDisabledReason === '当前商城没有待审核商品';
  const releaseStateVisible = publicationTask !== undefined || releaseFeedback !== undefined
    || (releaseDisabledReason !== undefined && !noPendingReview);
  const releaseMessage = releaseFeedback?.message ?? (noPendingReview ? undefined : releaseDisabledReason);

  return (
    <>
      <header className="producthero">
        <div className="productherotitle">
          <div>
            {partnerWorkspace ? <><h1>我的商品</h1>{coreTotal === undefined ? null : <strong>{formatCount(coreTotal)}</strong>}</> : (
              <><h1 className="sr-only">商品管理</h1><nav className="productworkspacetabs" aria-label="商品工作区">
                <button type="button" aria-current={workspace === 'catalog' ? 'page' : undefined} onClick={() => onWorkspace('catalog')}>
                  商品目录{workspace !== 'catalog' || coreTotal === undefined ? null : <strong>{formatCount(coreTotal)}</strong>}
                </button>
                <button type="button" aria-current={workspace === 'selection' ? 'page' : undefined} onClick={() => onWorkspace('selection')}>选品中心</button>
              </nav></>
            )}
            <small>{partnerWorkspace ? '维护商品资料与平台采用状态' : workspace === 'selection'
              ? '从供应链与品牌货盘快速挑选商品' : '点击商品查看资料、供应关系与上下架记录'}</small>
          </div>
        </div>
        {workspace === 'selection' ? null : <div className="productheroactions" role="group" aria-label={partnerWorkspace ? '供货工作台操作' : '商品管理操作'}>
          <button className="productaction" type="button" disabled={!writeEnabled} onClick={onImport}
            title={writeEnabled ? '批量导入本企业商品' : '当前范围没有商品导入权限'}>
            <ProductIcon name="upload" />批量导入
          </button>
          <button className="productaction" type="button" disabled={!exportReady} onClick={onExport}
            title={exportReady ? '仅导出当前已加载页，不包含其他分页' : '等待当前页加载完成'}>
            <ProductIcon name="download" />导出当前页
          </button>
          {partnerWorkspace ? null : (
            <button className="productaction productreleaseaction" type="button"
              disabled={releaseDisabledReason !== undefined}
              aria-describedby={releaseStateVisible ? 'productreleasestate' : undefined}
              onClick={onRelease}
              title={releaseDisabledReason === undefined ? '一次审核并上架当前商城全部合格商品'
                : noPendingReview ? '当前没有待审核商品，新增待审核商品后即可使用' : `暂不可用：${releaseDisabledReason}`}>
              <ProductIcon name="store" />
              {publicationTask?.state === 'queued' || publicationTask?.state === 'running'
                ? '正在审核上架…'
                : releasePending ? '正在创建上架任务…'
                  : `一键审核上架${pendingReviewCount === undefined || pendingReviewCount === 0 ? '' : ` ${formatCount(pendingReviewCount)}`}`}
            </button>
          )}
          <button className="productaction productcreateaction" type="button" disabled={!writeEnabled} onClick={onCreate}
            title={writeEnabled ? '手工录入单个商品并保存为草稿' : '当前范围没有商品创建权限'}>
            <ProductIcon name="plus" />新建商品
          </button>
        </div>}
        <p id="productcontractnotice" className="sr-only">
          商品写操作仅在当前商城已授权的管理范围内可用。
        </p>
      </header>
      {workspace === 'catalog' && !partnerWorkspace && releaseStateVisible ? (
        <section id="productreleasestate" className="productreleasestate" aria-label="商品发布状态">
          {publicationTask === undefined ? null : (
            <PublicationTaskStatus task={publicationTask} retryPending={releasePending} onRetry={onRetry} />
          )}
          {releaseMessage === undefined ? null : (
            <p className={`productreleasefeedback ${releaseFeedback?.tone === 'success'
              ? 'productreleasefeedbacksuccess' : 'productreleasefeedbackerror'}`}
              role={releaseFeedback?.tone === 'error' ? 'alert' : 'status'}>{releaseMessage}</p>
          )}
        </section>
      ) : null}
      {workspace === 'catalog' ? <nav className="producttabs" aria-label="按商品状态筛选">
        {tabs.map((tab) => {
          const count = tab.key === '' ? coreTotal : preview?.facets.statuses.find((facet) => facet.value === tab.key)?.count
            ?? page?.status_counts?.[tab.key];
          const disabled = tab.key !== '' && !previewEnabled && page?.status_counts === undefined;
          return (
            <button key={tab.key || 'all'} type="button" aria-current={status === tab.key ? 'page' : undefined} disabled={disabled} title={disabled ? '正在读取状态统计' : undefined} onClick={() => onStatus(tab.key)}>
              {partnerWorkspace ? partnerTabLabel(tab.key, tab.label) : tab.label}
              {count === undefined ? null : <strong>{formatCount(count)}</strong>}
            </button>
          );
        })}
      </nav> : null}
    </>
  );
}

function partnerTabLabel(key: (typeof tabs)[number]['key'], fallback: string): string {
  if (key === '') return '全部商品';
  if (key === 'pending_review') return '审核中';
  if (key === 'published') return '已采用';
  if (key === 'unpublished') return '未采用';
  return fallback;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function PublicationTaskStatus({ task, retryPending, onRetry }: Readonly<{
  task: CatalogPublicationTask;
  retryPending: boolean;
  onRetry: () => void;
}>) {
  const active = task.state === 'queued' || task.state === 'running';
  const knownTotal = task.total !== null;
  return (
    <section className="productpublicationtask" aria-label="商品发布任务" aria-live="polite">
      <p className="productpublicationmeta"><strong>{task.state === 'completed' && task.failed > 0
        ? '任务已完成（部分失败）' : publicationStateLabel(task.state)}</strong><span title={`任务 ID：${task.id}`}>任务 ID：{task.id}</span></p>
      {knownTotal && task.total! > 0 ? (
        <div className="productreleaseprogress" role={active ? 'status' : undefined}>
          <progress aria-label="商品发布进度" max={task.total!} value={Math.min(task.processed, task.total!)} />
          <span>已处理 {formatCount(task.processed)}/{formatCount(task.total!)}</span>
        </div>
      ) : <p className="productpublicationphase">{phaseLabel(task.phase, active)}</p>}
      <p className="productpublicationcounts">
        成功 {formatCount(task.succeeded)} · 失败 {formatCount(task.failed)} · 跳过 {formatCount(task.skipped)}
      </p>
      {task.failures.length === 0 ? null : (
        <details className="productpublicationfailures">
          <summary>查看失败明细 {formatCount(task.failures.length)} 件</summary>
          <ul>{task.failures.map((failure) => <PublicationFailure key={`${failure.id}:${failure.code}`} failure={failure} />)}</ul>
        </details>
      )}
      {!active && task.retryable_count > 0 ? (
        <button className="productretrypublication" type="button" disabled={retryPending} onClick={onRetry}
          title={retryPending ? '重试任务正在创建' : `仅重试 ${formatCount(task.retryable_count)} 个可重试失败项`}>
          {retryPending ? '正在创建重试任务…' : `重试 ${formatCount(task.retryable_count)} 个失败项`}
        </button>
      ) : null}
    </section>
  );
}

function PublicationFailure({ failure }: Readonly<{ failure: CatalogPublicationFailure }>) {
  return <li>
    <strong>{failure.title ?? '未找到商品'}</strong>
    <span>Listing：{failure.id} · SKU：{failure.sku_id ?? '—'}</span>
    <span>{failure.code}：{failure.message}</span>
    <span>{failure.retryable ? '可重试：系统只会重试此失败项。' : `不可重试。下一步：${failureNextStep(failure.code)}`}</span>
  </li>;
}

function publicationStateLabel(state: CatalogPublicationTask['state']): string {
  return ({ queued: '等待执行', running: '正在执行', completed: '任务已完成', failed: '任务执行失败',
    cancelled: '任务已取消', idle: '暂无任务' } as const)[state];
}

function phaseLabel(phase: string, active: boolean): string {
  if (!active) return phase === 'completed' ? '处理完成' : `阶段：${phase}`;
  return phase === 'queued' ? '任务已进入队列，正在等待处理。' : '正在处理商品，服务端尚未提供总数。';
}

function failureNextStep(code: string): string {
  if (code === 'LISTING_NOT_READY') return '补全商品资料、价格和库存后重新审核。';
  if (code === 'LISTING_STATE_INVALID') return '将商品恢复到待审核草稿状态后重新审核。';
  if (code === 'LISTING_NOT_FOUND') return '确认商品是否已删除；需要时重新导入商品。';
  return '按错误原因处理该商品后重新发起审核。';
}
