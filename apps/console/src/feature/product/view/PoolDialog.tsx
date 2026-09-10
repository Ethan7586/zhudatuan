import { Button, ChoiceButton } from '@shop/design';
import { presentProductPoolKind } from '@shop/presentation';
import type { PoolMode, ProductPoolViewModel } from '../viewmodel/ProductPoolViewModel';
import type { Pool } from '../model/Product';
import { isManagedListing } from '../model/ProductAction';
import { ProductIcon } from './ProductIcon';
import { ProductFlowModal } from './ProductFlowModal';
import { poolGuidance, poolSubmitLabel } from './PoolPresentation';

export function PoolDialog({ viewmodel, onClose }: Readonly<{ viewmodel: ProductPoolViewModel; onClose: () => void }>) {
  const listingMode = viewmodel.listing !== undefined;
  const listingPool = viewmodel.listing !== undefined && isManagedListing(viewmodel.listing) ? viewmodel.listing.pool_id : null;
  const listingPoolName = listingPool === null ? null : (viewmodel.pools.find((pool) => pool.id === listingPool)?.name ?? '当前商品池');
  const targetName = viewmodel.malls.find((mall) => mall.id === viewmodel.target)?.name ?? '所选商城';
  const sourceLabel = listingMode ? '目标商品池' : '来源商品池';
  const needsPool = viewmodel.operation !== 'remove';
  return (
    <ProductFlowModal open={viewmodel.open} label={listingMode ? '商品投池' : '商品池管理'} onClose={onClose} dismissable={!viewmodel.submitting} className="productpooldialog">
      <form
        className="productflowcontent"
        aria-label={listingMode ? '商品投池' : '商品池管理'}
        onSubmit={(event) => {
          event.preventDefault();
          viewmodel.submit();
        }}
      >
        <header>
          <div>
            <p>{listingMode ? '商品投放' : '商品池治理'}</p>
            <h2>{listingMode ? '商品投池' : '商品池管理'}</h2>
          </div>
          <Button className="productflowclose" tone="quiet" onPress={onClose} aria-label="关闭商品池窗口">
            <ProductIcon name="close" />
          </Button>
        </header>
        <div className="productflowbody">
          {viewmodel.listing === undefined ? null : (
            <section className="productpoolcontext" aria-label="当前商品">
              <span>当前商品</span>
              <strong>{viewmodel.listing.title}</strong>
              <small>{listingPoolName ? `当前已进入“${listingPoolName}”` : '当前尚未进入商品池'}</small>
            </section>
          )}
          {listingMode ? null : (
            <section className="productpoolcontext" aria-label="商品池使用顺序">
              <span>推荐使用顺序</span>
              <strong>准备商品 → 派生商品池 → 投放商城 → 定价、备货、校验资格并上架</strong>
              <small>商品池负责组织和分发供给，本身不会绕过价格、库存、资格与上架校验。</small>
            </section>
          )}
          <PoolTasks listingMode={listingMode} listingPool={listingPool} viewmodel={viewmodel} />
          {needsPool ? (
            <fieldset className="productpoolfield">
              <legend>2. 选择{sourceLabel}</legend>
              <p>{poolGuidance(viewmodel.operation)}</p>
              <section className="productpoolsummary" role="group" aria-label={sourceLabel}>
                {viewmodel.loading ? (
                  <p>正在读取商品池…</p>
                ) : viewmodel.pools.length === 0 ? (
                  <p>当前范围暂无可用商品池。</p>
                ) : (
                  viewmodel.pools.map((pool) => <PoolCard key={pool.id} pool={pool} selected={viewmodel.selected?.id === pool.id} disabled={listingMode && pool.id === listingPool} onSelect={viewmodel.select} />)
                )}
              </section>
            </fieldset>
          ) : null}
          {!listingMode && viewmodel.operation !== 'allocate' ? (
            <label>
              3. 目标商城
              <select value={viewmodel.target} onChange={(event) => viewmodel.setTarget(event.target.value)}>
                {viewmodel.malls.map((scope) => (
                  <option key={scope.id} value={scope.id}>
                    {scope.name ?? '商城名称暂不可用'}
                  </option>
                ))}
              </select>
              {viewmodel.targetsLoading ? <small>正在读取可投放商城…</small> : viewmodel.malls.length === 0 ? <small>当前范围没有可投放商城，请先在“集店 · 商城管理”创建商城。</small> : null}
            </label>
          ) : null}
          {viewmodel.operation === 'allocate' ? (
            <>
              <label>
                3. 新商品池类型
                <select value={viewmodel.kind} onChange={(event) => viewmodel.setKind(event.target.value as ProductPoolViewModel['kind'])}>
                  <option value="channel">渠道商品池</option>
                  <option value="markup">加价商品池</option>
                </select>
              </label>
              <label>
                4. 新商品池名称
                <input value={viewmodel.name} onChange={(event) => viewmodel.setName(event.target.value)} required maxLength={120} />
              </label>
            </>
          ) : null}
          <PoolResult operation={viewmodel.operation} listingTitle={viewmodel.listing?.title} currentPoolName={listingPoolName} selectedPool={viewmodel.selected} targetName={targetName} kind={viewmodel.kind} name={viewmodel.name} />
          {viewmodel.error === undefined ? null : (
            <p role="alert" className="productflowerror">
              {viewmodel.error}
            </p>
          )}
          {viewmodel.permissionReason === undefined ? null : (
            <p id="productpoolpermission" role="alert" className="productflowerror">
              {viewmodel.permissionReason}
            </p>
          )}
        </div>
        <footer>
          <Button onPress={onClose} isDisabled={viewmodel.submitting}>
            关闭
          </Button>
          <Button tone="primary" type="submit" isDisabled={!viewmodel.canSubmit || viewmodel.submitting} {...(viewmodel.permissionReason === undefined ? {} : { 'aria-describedby': 'productpoolpermission' })}>
            {viewmodel.submitting ? '正在执行…' : poolSubmitLabel(viewmodel.operation)}
          </Button>
        </footer>
      </form>
    </ProductFlowModal>
  );
}

function PoolTasks({ listingMode, listingPool, viewmodel }: Readonly<{ listingMode: boolean; listingPool: string | null; viewmodel: ProductPoolViewModel }>) {
  const choices: readonly PoolTask[] = listingMode
    ? [
        { mode: 'move', title: '移入其他商品池', description: '将当前未上架商品调整到另一个商品池。' },
        { mode: 'remove', title: '移出当前商品池', description: '解除商品与当前商品池的关系。', unavailable: listingPool === null },
      ]
    : [
        { mode: 'allocate', title: '创建派生池', description: '复制来源池商品，创建渠道池或加价池。' },
        { mode: 'attach', title: '投放到商城', description: '让目标商城可以使用所选商品池。' },
        { mode: 'detach', title: '停止商城投放', description: '解除目标商城与所选商品池的关系。' },
      ];
  return (
    <fieldset className="productpoolfield productpooltaskfield">
      <legend>1. 选择要完成的任务</legend>
      <div className="productpooltasks" role="radiogroup" aria-label="商品池任务">
        {choices.map((choice) => (
          <ChoiceButton
            key={choice.mode}
            className="productpooltask"
            data-visual-copy="multiline"
            kind="radio"
            selected={viewmodel.operation === choice.mode}
            disabled={choice.unavailable === true || !viewmodel.canMode(choice.mode)}
            onChoose={() => viewmodel.setOperation(choice.mode)}
          >
            <strong>{choice.title}</strong>
            <span>{choice.description}</span>
          </ChoiceButton>
        ))}
      </div>
    </fieldset>
  );
}

type PoolTask = Readonly<{ mode: PoolMode; title: string; description: string; unavailable?: boolean }>;

function PoolCard({ pool, selected, disabled, onSelect }: Readonly<{ pool: Pool; selected: boolean; disabled: boolean; onSelect: (id: string) => void }>) {
  return (
    <Button className="productpoolchoice" data-visual-copy="multiline" aria-pressed={selected} isDisabled={disabled} onPress={() => onSelect(pool.id)}>
      <strong>{pool.name}</strong>
      <span>
        {presentProductPoolKind(pool.kind)} · {pool.item_count} 件商品{disabled ? ' · 当前所在' : ''}
      </span>
    </Button>
  );
}

function PoolResult({
  operation,
  listingTitle,
  currentPoolName,
  selectedPool,
  targetName,
  kind,
  name,
}: Readonly<{
  operation: PoolMode;
  listingTitle: string | undefined;
  currentPoolName: string | null;
  selectedPool: Pool | undefined;
  targetName: string;
  kind: ProductPoolViewModel['kind'];
  name: string;
}>) {
  const selectedName = selectedPool?.name ?? '尚未选择的商品池';
  let title = '';
  let description = '';
  if (operation === 'move') {
    title = `“${listingTitle ?? '当前商品'}”将移入“${selectedName}”`;
    description = '仅草稿或已下架商品可以调整商品池；系统会校验当前版本，避免覆盖他人的修改。';
  } else if (operation === 'remove') {
    title = `“${listingTitle ?? '当前商品'}”将移出“${currentPoolName ?? '当前商品池'}”`;
    description = '移出后商品不再属于该池；如需销售，请重新投池并完成价格、库存、资格和上架检查。';
  } else if (operation === 'allocate') {
    title = `将在“${targetName}”创建“${name.trim() || '尚未命名的商品池'}”`;
    description = `系统会复制“${selectedName}”中的 ${selectedPool?.item_count ?? 0} 件商品，创建独立的${kind === 'markup' ? '加价商品池' : '渠道商品池'}；来源池不会被修改。`;
  } else if (operation === 'attach') {
    title = `“${selectedName}”将投放到“${targetName}”`;
    description = '目标商城将可以使用池内商品；商品仍需具备有效价格、库存和资格，并完成上架后才会对消费者可见。';
  } else {
    title = `“${targetName}”将停止使用“${selectedName}”`;
    description = '该商城将不再从此池获得商品供给；本次操作不会改动来源池，也不会删除历史订单。';
  }
  return (
    <section className="productpoolresult" aria-label="执行结果预览" aria-live="polite">
      <span>执行后</span>
      <strong>{title}</strong>
      <p>{description}</p>
    </section>
  );
}
