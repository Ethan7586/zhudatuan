import { Button } from '@shop/design';
import type { ProductStockViewModel } from '../viewmodel/ProductStockViewModel';
import { ProductFlowModal } from './ProductFlowModal';
import { ProductIcon } from './ProductIcon';
import { productStockLocation, productStockStage } from './ProductStockPresentation';

export function ProductStockDialog({ viewmodel }: Readonly<{ viewmodel: ProductStockViewModel }>) {
  const title = viewmodel.listing?.title ?? '当前商品';
  return (
    <ProductFlowModal open={viewmodel.open} label="补充库存" onClose={viewmodel.actions.close} dismissable={!viewmodel.busy} className="productstockdialog">
      <form
        className="productflowcontent"
        aria-label="补充库存"
        onSubmit={(event) => {
          event.preventDefault();
          viewmodel.actions.submit();
        }}
      >
        <header>
          <div>
            <p>商品上架主流程</p>
            <h2>补充库存</h2>
          </div>
          <Button className="productflowclose" tone="quiet" onPress={viewmodel.actions.close} aria-label="关闭补充库存窗口" isDisabled={viewmodel.busy}>
            <ProductIcon name="close" />
          </Button>
        </header>
        <div className="productflowbody">
          <section className="productstockcontext" aria-label="当前商品">
            <span>当前商品</span>
            <strong data-visual-copy="truncate" title={title}>
              {title}
            </strong>
            <small>直接填写本次入库数量，无需准备或上传表格。</small>
          </section>

          {viewmodel.loading ? (
            <p className="productstockloading" role="status">
              正在读取实时库存…
            </p>
          ) : null}
          {viewmodel.queryError === undefined ? null : (
            <section className="productstockissue" role="alert">
              <p>{viewmodel.queryError}</p>
              <Button onPress={viewmodel.actions.retryStock}>重新读取</Button>
            </section>
          )}

          {!viewmodel.loading && viewmodel.queryError === undefined && !viewmodel.completed ? (
            <>
              {viewmodel.sources.length > 1 ? (
                <label>
                  库存地点
                  <select value={viewmodel.location} onChange={(event) => viewmodel.actions.location(event.target.value)} disabled={viewmodel.busy}>
                    {viewmodel.sources.map((source, index) => (
                      <option key={source.id} value={source.location}>
                        {productStockLocation(source, index)}
                      </option>
                    ))}
                  </select>
                  <small>选择本次货物实际进入的库存地点。</small>
                </label>
              ) : (
                <section className="productstocklocation" aria-label="库存地点">
                  <span>库存地点</span>
                  <strong>{viewmodel.sources[0] === undefined ? '主仓（默认）' : productStockLocation(viewmodel.sources[0], 0)}</strong>
                </section>
              )}
              <div className="productstockfields">
                <label>
                  本次增加数量
                  <input type="number" min="1" max="999999999" step="1" inputMode="numeric" value={viewmodel.quantity} onChange={(event) => viewmodel.actions.quantity(event.target.value)} required disabled={viewmodel.busy} />
                  <small>填写这次实际入库的件数。</small>
                </label>
                <label>
                  安全库存
                  <input type="number" min="0" max="999999999" step="1" inputMode="numeric" value={viewmodel.safety} onChange={(event) => viewmodel.actions.safety(event.target.value)} required disabled={viewmodel.busy} />
                  <small>低于该数量时暂停继续售卖。</small>
                </label>
              </div>
              <section className="productstockpreview" aria-label="补充结果预览" aria-live="polite">
                <span>确认后</span>
                <div>
                  <p>
                    <small>当前现货</small>
                    <strong>{viewmodel.currentOnhand}</strong>
                  </p>
                  <b aria-hidden="true">+</b>
                  <p>
                    <small>本次增加</small>
                    <strong>{viewmodel.quantity || '0'}</strong>
                  </p>
                  <b aria-hidden="true">=</b>
                  <p>
                    <small>入库后现货</small>
                    <strong>{viewmodel.targetOnhand}</strong>
                  </p>
                </div>
                <p>
                  扣除安全库存和已预留数量后，预计可售 <strong>{viewmodel.targetAvailable}</strong> 件。
                </p>
              </section>
              {viewmodel.validation === undefined ? null : (
                <p className="productflowerror" role="alert">
                  {viewmodel.validation}
                </p>
              )}
            </>
          ) : null}

          {viewmodel.stage === undefined ? null : (
            <section className="productstockprogress" data-stage={viewmodel.stage} role="status" aria-live="polite">
              <span aria-hidden="true" />
              <p>{productStockStage(viewmodel.stage)}</p>
            </section>
          )}
          {viewmodel.error === undefined ? null : (
            <p className="productflowerror" role="alert">
              {viewmodel.error}
            </p>
          )}
          {viewmodel.permissionReason === undefined ? null : (
            <p id="productstockpermission" className="productflowerror" role="alert">
              {viewmodel.permissionReason}
            </p>
          )}
        </div>
        <footer className="productstockfooter">
          {!viewmodel.completed ? (
            <Button className="productstockbatch" tone="quiet" onPress={viewmodel.actions.batch} isDisabled={viewmodel.busy}>
              需要批量补库存
            </Button>
          ) : null}
          <Button onPress={viewmodel.actions.close} isDisabled={viewmodel.busy}>
            {viewmodel.completed ? '完成' : '取消'}
          </Button>
          {!viewmodel.completed ? (
            <Button tone="primary" type="submit" isDisabled={!viewmodel.canSubmit || viewmodel.busy} {...(viewmodel.permissionReason === undefined ? {} : { 'aria-describedby': 'productstockpermission' })}>
              {viewmodel.busy ? '正在补充…' : viewmodel.error === undefined ? '确认补充库存' : '重新提交'}
            </Button>
          ) : null}
        </footer>
      </form>
    </ProductFlowModal>
  );
}
