import type { OperationId } from '@shop/contract';
import {
  OP_CATALOG_LISTINGS_POOL_SET,
  OP_CATALOG_LISTINGS_PRICE_SET,
  OP_CATALOG_LISTINGS_PUBLISH,
  OP_CATALOG_LISTINGS_UNPUBLISH,
  OP_CATALOG_PRODUCT_DETAIL_READ,
  OP_CATALOG_PRODUCTS_ARCHIVE,
  OP_CATALOG_PRODUCTS_UPDATE,
} from '@shop/contract/ids';
import { chineseReference, editableProductStatus } from '@shop/presentation';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ProductDrawerPanels, type ProductDrawerTab } from './ProductDrawerPanels';
import { ProductIcon } from './ProductIcon';
import type { Listing, ProductDetail } from '../model/Product';
import { StatusBadge } from './ProductTable';
import type { ProductAction } from '../model/ProductAction';
import { canChangeListingPublication, isManagedListing, isPublishedListing, productVersion } from '../model/ProductAction';
import type { ProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';

const tabs: readonly Readonly<{ key: ProductDrawerTab; label: string }>[] = Object.freeze([
  { key: 'overview', label: '概览' },
  { key: 'sku', label: '规格与库存' },
  { key: 'malls', label: '商城与售价' },
  { key: 'source', label: '来源与供货' },
  { key: 'changes', label: '变更记录' },
]);

interface ProductDrawerProps {
  readonly listing?: Listing;
  readonly tab: ProductDrawerTab;
  readonly detail?: ProductDetail;
  readonly sections: ProductDetailViewModel['sections'];
  readonly onTab: (tab: ProductDrawerTab) => void;
  readonly onClose: () => void;
  readonly onDetail: (listing: Listing) => void;
  readonly onAction: (action: ProductAction) => void;
  readonly onPool: (listing: Listing) => void;
  readonly canUse: (operation: OperationId) => boolean;
}

export function ProductDrawer({ listing, tab, detail, sections, onTab, onClose, onDetail, onAction, onPool, canUse }: ProductDrawerProps) {
  return (
    <ModalOverlay
      className="productdraweroverlay"
      isDismissable
      isOpen={listing !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal className="productdrawer">
        <AriaDialog className="productdrawercontent" aria-label={listing?.title ?? '商品详情'}>
          {({ close }) =>
            listing === undefined ? null : (
              <ProductDrawerContent listing={listing} tab={tab} {...(detail === undefined ? {} : { detail })} sections={sections} onTab={onTab} onClose={close} onDetail={onDetail} onAction={onAction} onPool={onPool} canUse={canUse} />
            )
          }
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ProductDrawerContent({
  listing,
  tab,
  detail,
  sections,
  onTab,
  onClose,
  onDetail,
  onAction,
  onPool,
  canUse,
}: Readonly<{
  listing: Listing;
  tab: ProductDrawerTab;
  detail?: ProductDetail;
  sections: ProductDetailViewModel['sections'];
  onTab: (tab: ProductDrawerTab) => void;
  onClose: () => void;
  onDetail: (listing: Listing) => void;
  onAction: (action: ProductAction) => void;
  onPool: (listing: Listing) => void;
  canUse: (operation: OperationId) => boolean;
}>) {
  const published = isPublishedListing(listing.status);
  const publicationOperation = published ? OP_CATALOG_LISTINGS_UNPUBLISH : OP_CATALOG_LISTINGS_PUBLISH;
  const publicationAllowed = canUse(publicationOperation);
  const canChangePublication = publicationAllowed && isManagedListing(listing) && canChangeListingPublication(listing.status, detail?.status);
  const expectedVersion = productVersion(detail?.version);
  const hasProduct = typeof listing.product_id === 'string' && listing.product_id !== '';
  const canReadDetail = canUse(OP_CATALOG_PRODUCT_DETAIL_READ);
  const canChangePrice = canUse(OP_CATALOG_LISTINGS_PRICE_SET);
  const canArchive = canUse(OP_CATALOG_PRODUCTS_ARCHIVE);
  const canEdit = canUse(OP_CATALOG_PRODUCTS_UPDATE);
  const canPool = canUse(OP_CATALOG_LISTINGS_POOL_SET);
  const price = sections.pricing.condition === 'ready' ? sections.pricing.data?.prices.find((item) => item.scope === listing.scope_id && item.sku === listing.sku_id) : undefined;
  const priceVersion = sections.pricing.condition === 'ready' ? (price === undefined ? 0 : productVersion(price.priceVersion)) : undefined;
  return (
    <>
      <header className="productdrawerheader">
        <div className="productdraweridentity">
          <span className="productdrawerthumbnail" data-tone="neutral">
            {listing.cover_url == null || listing.cover_url === '' ? <ProductIcon name="cube" /> : <img src={listing.cover_url} alt="" />}
          </span>
          <div>
            <Heading slot="title">{listing.title}</Heading>
            <p>{chineseReference('商品', listing.product_id)}</p>
            <span className="productdrawermeta">
              <StatusBadge status={listing.status} />
              <small>第 {listing.version} 版</small>
              <small>列表快照</small>
            </span>
          </div>
        </div>
        <div className="productdrawerheaderactions">
          <button
            className="productdrawerfulldetail"
            type="button"
            aria-label="打开完整商品详情"
            disabled={!hasProduct || !canReadDetail}
            title={!hasProduct ? '渠道商品尚未映射到商品主档' : !canReadDetail ? '当前账号没有查看完整商品详情的权限。' : undefined}
            onClick={() => onDetail(listing)}
          >
            <ProductIcon name="eye" />
            <span>打开完整详情</span>
          </button>
          <button className="productdrawerclose" type="button" aria-label="关闭商品详情" onClick={onClose}>
            <ProductIcon name="close" />
          </button>
        </div>
      </header>
      <div className="productdrawertabs" role="tablist" aria-label="商品详情">
        {tabs.map((item) => (
          <button key={item.key} id={`producttab-${item.key}`} type="button" role="tab" aria-selected={tab === item.key} aria-controls="productdrawerpanel" onClick={() => onTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <div id="productdrawerpanel" className="productdrawerbody" role="tabpanel" aria-labelledby={`producttab-${tab}`}>
        <ProductDrawerPanels tab={tab} listing={listing} detail={detail} sections={sections} onPool={onPool} canPool={canPool} />
      </div>
      <footer className="productdrawerfooter">
        <button type="button" onClick={onClose}>
          关闭
        </button>
        <button
          type="button"
          disabled={!canChangePublication}
          title={!publicationAllowed ? '当前账号没有上架或下架商品的权限。' : !canChangePublication ? (!isManagedListing(listing) ? '渠道商品尚未映射，不能直接上架或下架' : '请先把商品状态设为启用') : undefined}
          onClick={() => {
            onClose();
            onAction({ operation: publicationOperation, listing });
          }}
        >
          {published ? '下架' : '上架'}
        </button>
        <button
          type="button"
          disabled={priceVersion === undefined || !canChangePrice}
          title={!canChangePrice ? '当前账号没有设置商品价格的权限。' : priceVersion === undefined ? '正在读取当前售价版本' : undefined}
          onClick={() => {
            if (priceVersion === undefined) return;
            onClose();
            onAction({ operation: OP_CATALOG_LISTINGS_PRICE_SET, listing, expectedVersion: priceVersion });
          }}
        >
          设置价格
        </button>
        <button
          type="button"
          disabled={expectedVersion === undefined || !hasProduct || !canArchive}
          title={!hasProduct ? '渠道商品尚未映射到商品主档' : !canArchive ? '当前账号没有归档商品的权限。' : expectedVersion === undefined ? '正在读取商品主档版本' : undefined}
          onClick={() => {
            if (expectedVersion === undefined) return;
            onClose();
            onAction({ operation: OP_CATALOG_PRODUCTS_ARCHIVE, listing, expectedVersion });
          }}
        >
          归档
        </button>
        <button
          className="productactionprimary"
          type="button"
          disabled={expectedVersion === undefined || !hasProduct || !canEdit}
          title={!hasProduct ? '渠道商品尚未映射到商品主档' : !canEdit ? '当前账号没有编辑商品的权限。' : expectedVersion === undefined ? '正在读取商品主档版本' : undefined}
          onClick={() => {
            if (expectedVersion === undefined) return;
            onClose();
            onAction({ operation: OP_CATALOG_PRODUCTS_UPDATE, listing, status: editableProductStatus(detail?.status), expectedVersion });
          }}
        >
          <ProductIcon name="edit" />
          编辑商品
        </button>
      </footer>
    </>
  );
}
