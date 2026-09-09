import { Button, DataTable, MetricGrid, ResourcePanel, ResourceState, SectionBoundary, type ResourceCondition } from '@shop/design';
import { chineseSectionLabel, presentProductMediaKind, presentProductStatus, presentProductType, presentResourceCondition } from '@shop/presentation';
import { formatDate } from '../../../shared/ui/Format';
import type { ProductDetail } from '../model/Product';
import type { ProductDetailSectionViewModel, ProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';
import { channelColumns, formatInteger, poolColumns, priceColumns, qualificationColumns, skuColumns, stockColumns, timelineColumns } from './ProductDetailColumns';

export function ProductDetailPage({ routeTitle, onBack, viewmodel }: Readonly<{ routeTitle: string; onBack: () => void; viewmodel: ProductDetailViewModel }>) {
  const data = viewmodel.data;
  return (
    <ResourcePanel
      title={data?.title ?? routeTitle}
      eyebrow={chineseSectionLabel('商品详情')}
      description={data === undefined ? '正在读取商品权威主档。' : (data.subtitle ?? '商品主档')}
      condition={viewmodel.condition}
      {...(viewmodel.error === undefined ? {} : { error: viewmodel.error })}
      retry={viewmodel.refresh}
      actions={
        <>
          <Button onPress={onBack}>返回商品列表</Button>
          <Button onPress={viewmodel.refresh}>刷新全部分区</Button>
        </>
      }
    >
      {data === undefined ? <span /> : <ProductDetailContent data={data} viewmodel={viewmodel} />}
    </ResourcePanel>
  );
}

function ProductDetailContent({ data, viewmodel }: Readonly<{ data: ProductDetail; viewmodel: ProductDetailViewModel }>) {
  const { core, pricing, inventory, qualification } = viewmodel.sections;
  return (
    <div className="productdetailworkspace">
      <ProductHero data={data} />
      <MetricGrid
        items={[
          { label: '商品状态', value: presentProductStatus(data.status).label, detail: presentProductType(data.product_type) },
          { label: '商品规格', value: formatInteger(data.skus.length), detail: '商品主档权威数据' },
          { label: '商城投放', value: formatInteger(data.listings.length), detail: '当前授权范围' },
          { label: '商品池', value: formatInteger(data.pools.length), detail: '当前投池关系' },
          { label: '渠道来源', value: formatInteger(data.channels.length), detail: '最近同步映射' },
          { label: '主档版本', value: `第 ${formatInteger(data.version)} 版`, detail: formatDate(data.updatedAt) },
        ]}
      />
      <DetailSection id="productbase" title="基础信息" description="商品中心维护的权威主档字段。" model={core}>
        <dl className="productdetailfacts">
          <Entry label="商品名称" value={data.title} />
          <Entry label="商品类型" value={presentProductType(data.product_type)} />
          <Entry label="分类" value={data.category_name} />
          <Entry label="品牌" value={data.brand_name ?? '未绑定品牌'} />
          <Entry label="商品所有方" value={data.owner_partner_name ?? '平台自营'} />
          <Entry label="创建时间" value={formatDate(data.createdAt)} />
          <Entry label="更新时间" value={formatDate(data.updatedAt)} />
        </dl>
        {data.description === null ? null : <p className="productdetaildescription">{data.description}</p>}
      </DetailSection>
      <DetailSection id="productskus" title="规格" description="规格编码、属性、状态和并发版本。" model={core} empty={data.skus.length === 0} emptyMessage="该商品尚未建立规格。">
        <DataTable caption="商品规格" rows={data.skus} columns={skuColumns} rowKey={(row) => row.id} />
      </DetailSection>
      <DetailSection id="productmedia" title="媒体" description="商品封面、图片、视频与业务文档。" model={core} empty={data.media.length === 0} emptyMessage="该商品尚未上传媒体资料。">
        <MediaGrid rows={data.media} />
      </DetailSection>
      <DetailSection id="productprices" title="报价" description="定价域返回的当前范围报价；不会使用列表快照冒充。" model={pricing} empty={pricing.data?.prices.length === 0} emptyMessage="当前授权范围暂无有效报价。">
        {pricing.data === undefined ? null : <DataTable caption="商品报价" rows={pricing.data.prices} columns={priceColumns} rowKey={(row) => `${row.sku}:${row.scope}:${row.bookVersion}:${row.effectiveAt}`} />}
      </DetailSection>
      <DetailSection id="productinventory" title="库存" description="库存域返回的在手、安全与可售数量。" model={inventory} empty={inventory.data?.inventory.length === 0} emptyMessage="当前授权范围暂无库存记录。">
        {inventory.data === undefined ? null : <DataTable caption="商品库存" rows={inventory.data.inventory} columns={stockColumns} rowKey={(row) => `${row.sku}:${row.scope}:${row.location}`} />}
      </DetailSection>
      <DetailSection
        id="productqualification"
        title="资格"
        description="资格域按商城投放计算的当前售卖结论。"
        model={qualification}
        empty={qualification.data?.qualifications.length === 0}
        emptyMessage="当前商品没有需要展示的商城资格结论。"
      >
        {qualification.data === undefined ? null : <DataTable caption="商品资格" rows={qualification.data.qualifications} columns={qualificationColumns} rowKey={(row) => row.listing} />}
      </DetailSection>
      <DetailSection id="productchannels" title="渠道" description="上游渠道商品映射与最近同步证据。" model={core} empty={data.channels.length === 0} emptyMessage="该商品没有外部渠道来源，当前为平台自营商品。">
        <DataTable caption="商品渠道" rows={data.channels} columns={channelColumns} rowKey={(row) => `${row.provider}:${row.externalId}`} />
      </DetailSection>
      <DetailSection id="productpools" title="投池" description="当前授权范围内可见的商品池和商城投放关系。" model={core} empty={data.pools.length === 0} emptyMessage="该商品尚未进入当前范围可见的商品池。">
        <DataTable caption="商品投池" rows={data.pools} columns={poolColumns} rowKey={(row) => row.id} />
      </DetailSection>
      <DetailSection id="producttimeline" title="时间线" description="商品主档、商城投放和渠道同步的真实时间证据。" model={core} empty={data.timeline.length === 0} emptyMessage="该商品暂无可见变更记录。">
        <DataTable caption="商品时间线" rows={data.timeline} columns={timelineColumns} rowKey={(row) => row.id} />
      </DetailSection>
    </div>
  );
}

function ProductHero({ data }: Readonly<{ data: ProductDetail }>) {
  return (
    <header className="productdetailhero">
      <div className="productdetailcover">{data.cover_url === null ? <span aria-hidden="true">商</span> : <img src={data.cover_url} alt={`${data.title}封面`} />}</div>
      <div>
        <p className="eyebrow">{presentProductType(data.product_type)}</p>
        <h2>{data.title}</h2>
        <p>{data.subtitle ?? '暂无商品副标题'}</p>
        <div className="productdetailtags">
          <span>{presentProductStatus(data.status).label}</span>
          <span>第 {formatInteger(data.version)} 版</span>
          <span>{data.category_name}</span>
        </div>
      </div>
    </header>
  );
}

function DetailSection({
  id,
  title,
  description,
  model,
  empty = false,
  emptyMessage,
  children,
}: Readonly<{ id: string; title: string; description: string; model: ProductDetailSectionViewModel; empty?: boolean; emptyMessage?: string; children: React.ReactNode }>) {
  const condition: ResourceCondition = model.condition === 'ready' && empty ? 'empty' : model.condition;
  return (
    <section className="productdetailsection" aria-labelledby={id}>
      <header>
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
        <span className={`productsectionstate is${condition}`}>{presentResourceCondition(condition)}</span>
      </header>
      <SectionBoundary title={`${title}暂时无法显示`} resetKey={condition}>
        <ResourceState condition={condition} {...(model.error === undefined ? {} : { error: model.error })} retry={model.refresh} emptyTitle={`暂无${title}`} emptyMessage={emptyMessage ?? `当前范围没有${title}数据。`}>
          {children}
        </ResourceState>
      </SectionBoundary>
    </section>
  );
}

function MediaGrid({ rows }: Readonly<{ rows: ProductDetail['media'] }>) {
  return (
    <div className="productmediagrid">
      {rows.map((media) => (
        <article key={media.id}>
          {media.kind === 'image' ? <img src={media.url} alt={media.alt ?? presentProductMediaKind(media.kind).title} /> : <span aria-hidden="true">{presentProductMediaKind(media.kind).badge}</span>}
          <div>
            <strong>{media.alt ?? presentProductMediaKind(media.kind).title}</strong>
            <a href={media.url} target="_blank" rel="noreferrer">
              打开原始资料
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

function Entry({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
