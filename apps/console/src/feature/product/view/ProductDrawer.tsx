import type { OperationId } from '@shop/contract';
import { OP_CATALOG_LISTINGS_POOL_SET, OP_CATALOG_PRODUCT_DETAIL_READ } from '@shop/contract/ids';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ProductDrawerPanels, type ProductDrawerTab } from './ProductDrawerPanels';
import { ProductIcon } from './ProductIcon';
import type { Listing, ProductDetail } from '../model/Product';
import { StatusBadge } from './ProductTable';
import type { ProductAction } from '../model/ProductAction';
import type { ProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';
import { productJourney } from '../model/ProductJourney';
import { ProductJourney } from './ProductJourney';
import { ProductDrawerActions } from './ProductDrawerActions';

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
  readonly onPool: (listing: Listing, intent?: 'move' | 'deliver') => void;
  readonly onInventory: (listing: Listing) => void;
  readonly onQualification: (listing: Listing) => void;
  readonly canUse: (operation: OperationId) => boolean;
}

export function ProductDrawer({ listing, tab, detail, sections, onTab, onClose, onDetail, onAction, onPool, onInventory, onQualification, canUse }: ProductDrawerProps) {
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
              <ProductDrawerContent
                listing={listing}
                tab={tab}
                {...(detail === undefined ? {} : { detail })}
                sections={sections}
                onTab={onTab}
                onClose={close}
                onDetail={onDetail}
                onAction={onAction}
                onPool={onPool}
                onInventory={onInventory}
                onQualification={onQualification}
                canUse={canUse}
              />
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
  onInventory,
  onQualification,
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
  onPool: (listing: Listing, intent?: 'move' | 'deliver') => void;
  onInventory: (listing: Listing) => void;
  onQualification: (listing: Listing) => void;
  canUse: (operation: OperationId) => boolean;
}>) {
  const hasProduct = typeof listing.product_id === 'string' && listing.product_id !== '';
  const canReadDetail = canUse(OP_CATALOG_PRODUCT_DETAIL_READ);
  const canPool = canUse(OP_CATALOG_LISTINGS_POOL_SET);
  const journey = productJourney(listing);
  return (
    <>
      <header className="productdrawerheader">
        <div className="productdraweridentity">
          <span className="productdrawerthumbnail" data-tone="neutral">
            {listing.cover_url == null || listing.cover_url === '' ? <ProductIcon name="cube" /> : <img src={listing.cover_url} alt="" />}
          </span>
          <div>
            <Heading slot="title" data-visual-copy="truncate" title={listing.title}>
              {listing.title}
            </Heading>
            <p>{listing.subtitle ?? listing.category_name ?? '商品主档'}</p>
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
            onClick={() => {
              onClose();
              onDetail(listing);
            }}
          >
            <ProductIcon name="eye" />
            <span>完整商品详情</span>
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
        {tab === 'overview' ? <ProductJourney journey={journey} /> : null}
        <ProductDrawerPanels
          tab={tab}
          listing={listing}
          detail={detail}
          sections={sections}
          onPool={(target) => {
            onClose();
            onPool(target, 'move');
          }}
          canPool={canPool}
        />
      </div>
      <ProductDrawerActions
        listing={listing}
        {...(detail === undefined ? {} : { detail })}
        sections={sections}
        journey={journey}
        onClose={onClose}
        onDetail={onDetail}
        onAction={onAction}
        onPool={onPool}
        onInventory={onInventory}
        onQualification={onQualification}
        canUse={canUse}
      />
    </>
  );
}
