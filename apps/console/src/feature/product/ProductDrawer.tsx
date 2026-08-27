import { useState } from 'react';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { ProductDrawerPanels, type ProductDrawerTab } from './ProductDrawerPanels';
import { ProductIcon } from './ProductIcon';
import type { Listing } from './ProductSchema';
import { StatusBadge } from './ProductTable';

const tabs: readonly Readonly<{ key: ProductDrawerTab; label: string }>[] = Object.freeze([
  { key: 'overview', label: '概览' },
  { key: 'sku', label: 'SKU与库存' },
  { key: 'malls', label: '商城与售价' },
  { key: 'source', label: '来源与供货' },
  { key: 'changes', label: '变更记录' },
]);

interface ProductDrawerProps {
  readonly listing?: Listing;
  readonly previewEnabled: boolean;
  readonly onClose: () => void;
}

export function ProductDrawer({ listing, previewEnabled, onClose }: ProductDrawerProps) {
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
          {({ close }) => (listing === undefined ? null : <ProductDrawerContent key={listing.id} listing={listing} previewEnabled={previewEnabled} onClose={close} />)}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ProductDrawerContent({
  listing,
  previewEnabled,
  onClose,
}: Readonly<{
  listing: Listing;
  previewEnabled: boolean;
  onClose: () => void;
}>) {
  const [tab, setTab] = useState<ProductDrawerTab>('overview');
  const preview = previewEnabled && listing.preview?.kind === 'console-product-v1' ? listing.preview : undefined;
  return (
    <>
      <header className="productdrawerheader">
        <div className="productdraweridentity">
          <span className="productdrawerthumbnail" data-tone={preview?.tone ?? 'neutral'}>
            {listing.cover_url == null || listing.cover_url === '' ? <ProductIcon name="cube" /> : <img src={listing.cover_url} alt="" />}
          </span>
          <div>
            <Heading slot="title">{listing.title}</Heading>
            <p>{preview?.spu ?? listing.product_id}</p>
            <span className="productdrawermeta">
              <StatusBadge status={listing.status} />
              <small>v{listing.version}</small>
              {preview === undefined ? <small>列表快照</small> : <small>本地预览</small>}
            </span>
          </div>
        </div>
        <button className="productdrawerclose" type="button" aria-label="关闭商品详情" onClick={onClose}>
          <ProductIcon name="close" />
        </button>
      </header>
      <div className="productdrawertabs" role="tablist" aria-label="商品详情">
        {tabs.map((item) => (
          <button key={item.key} id={`producttab-${item.key}`} type="button" role="tab" aria-selected={tab === item.key} aria-controls="productdrawerpanel" onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      <div id="productdrawerpanel" className="productdrawerbody" role="tabpanel" aria-labelledby={`producttab-${tab}`}>
        <ProductDrawerPanels tab={tab} listing={listing} {...(preview === undefined ? {} : { preview })} onResolve={() => setTab('malls')} />
      </div>
      <footer className="productdrawerfooter">
        <button type="button" onClick={onClose}>
          关闭
        </button>
        <button className="productactionprimary" type="button" disabled title="编辑 Operation、版本校验与回执尚未闭合">
          <ProductIcon name="edit" />
          编辑商品
        </button>
      </footer>
    </>
  );
}
