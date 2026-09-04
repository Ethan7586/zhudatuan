import type { ProductBatch } from '../model/Product';
import type { ProductBatchViewModel } from '../viewmodel/ProductBatchViewModel';
import { presentCatalogGap, presentProductBatchAction, presentProductBatchState } from '@shop/presentation';

export function ProductBatchDialog({ viewmodel }: Readonly<{ viewmodel: ProductBatchViewModel }>) {
  const draft = viewmodel.draft;
  if (!viewmodel.open || draft === undefined) return null;
  const result = viewmodel.receipt ?? viewmodel.preview;
  const action = presentProductBatchAction(draft.action);
  return (
    <div className="productflowoverlay">
      <button className="productflowbackdrop" type="button" onClick={viewmodel.actions.close} aria-label="关闭商品批量操作窗口" disabled={viewmodel.busy} />
      <section className="productflowdialog productbatchdialog" role="dialog" aria-modal="true" aria-labelledby="productbatchtitle">
        <header>
          <div>
            <p>服务端预检 · 逐项收据</p>
            <h2 id="productbatchtitle">批量{action}</h2>
          </div>
          <button type="button" onClick={viewmodel.actions.close} aria-label="关闭商品批量操作窗口" disabled={viewmodel.busy}>
            ×
          </button>
        </header>
        <div className="productflowbody productbatchcontent">
          {viewmodel.busy && result === undefined ? <BatchLoading action={action} /> : null}
          {result ? <BatchResult result={result} viewmodel={viewmodel} /> : null}
          {viewmodel.error ? (
            <section className="productbatcherror" role="alert">
              <h3>本次请求未完成</h3>
              <p>{viewmodel.error}</p>
            </section>
          ) : null}
          {viewmodel.preview && !viewmodel.receipt && viewmodel.preview.count > 0 ? (
            <>
              <label className="productimportconfirm">
                <input type="checkbox" checked={viewmodel.confirmed} disabled={viewmodel.busy} onChange={(event) => viewmodel.actions.confirmed(event.target.checked)} />
                我已核对可执行项和阻断原因；确认后仅对标记为“可执行”的商品生效。
              </label>
              {viewmodel.assurance < 2 ? (
                <section>
                  <h3>需要二次验证</h3>
                  <p>批量发布属于高风险操作，请先完成二次验证。</p>
                  <button type="button" onClick={viewmodel.actions.stepup}>
                    立即验证
                  </button>
                </section>
              ) : null}
            </>
          ) : null}
          <BatchFooter viewmodel={viewmodel} />
        </div>
      </section>
    </div>
  );
}

function BatchLoading({ action }: Readonly<{ action: string }>) {
  return (
    <section className="productimportstate" role="status">
      <span className="productimportspinner" aria-hidden="true" />
      <div>
        <strong>正在预检批量{action}</strong>
        <p>服务端正在核对商品版本、资格、价格、库存、商品池和渠道状态。</p>
      </div>
    </section>
  );
}

function BatchResult({ result, viewmodel }: Readonly<{ result: ProductBatch; viewmodel: ProductBatchViewModel }>) {
  const titles = new Map(viewmodel.draft?.listings.map((listing) => [listing.id, listing.title]));
  const executed = result.phase === 'executed';
  return (
    <>
      <div className="productbatchsummary" role="status">
        <span>
          <small>本次范围</small>
          <strong>{result.items.length}</strong>
        </span>
        <span>
          <small>{executed ? '执行成功' : '可以执行'}</small>
          <strong>{result.count}</strong>
        </span>
        <span>
          <small>{executed ? '执行失败' : '暂不可执行'}</small>
          <strong>{result.failed}</strong>
        </span>
      </div>
      <p>{executed ? '以下是服务端逐项执行收据；重试只包含失败项，不会再次处理成功项。' : '预检凭证已绑定当前商品版本与依赖证据；数据变化后执行会被服务端拒绝并要求重新预检。'}</p>
      <ul className="productbatchitems" aria-label={executed ? '商品批量执行收据' : '商品批量预检结果'}>
        {result.items.map((item) => (
          <li key={item.id} data-state={item.state}>
            <div>
              <strong>{titles.get(item.id) ?? '已不可见的商品'}</strong>
              <small>当前版本 {item.version ?? '—'}</small>
            </div>
            <span>{item.state === 'failed' ? failureText(item.error, item.gaps) : presentProductBatchState(item.state)}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function BatchFooter({ viewmodel }: Readonly<{ viewmodel: ProductBatchViewModel }>) {
  const preview = viewmodel.preview;
  const receipt = viewmodel.receipt;
  return (
    <footer>
      <button type="button" onClick={viewmodel.actions.close} disabled={viewmodel.busy}>
        {receipt ? '完成' : '取消'}
      </button>
      {(!preview || viewmodel.executeFailed) && !viewmodel.busy ? (
        <button type="button" className="productactionprimary" onClick={viewmodel.actions.preview}>
          重新预检
        </button>
      ) : null}
      {preview && !receipt && !viewmodel.executeFailed ? (
        <button type="button" className="productactionprimary" onClick={viewmodel.actions.execute} disabled={viewmodel.busy || preview.count < 1 || !viewmodel.confirmed}>
          {viewmodel.busy ? '正在执行…' : `确认执行 ${preview.count} 项`}
        </button>
      ) : null}
      {receipt && receipt.failed > 0 ? (
        <button type="button" className="productactionprimary" onClick={viewmodel.actions.retry} disabled={viewmodel.busy}>
          仅重试 {receipt.failed} 个失败项
        </button>
      ) : null}
    </footer>
  );
}

function failureText(error: string | null, gaps: readonly string[]): string {
  return presentCatalogGap(gaps[0], presentCatalogGap(error));
}
