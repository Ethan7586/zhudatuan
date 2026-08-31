import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog as AriaDialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { ProductDrawerPanels, type ProductDrawerTab } from './ProductDrawerPanels';
import { ProductIcon } from './ProductIcon';
import type { Listing } from './ProductSchema';
import { StatusBadge } from './ProductTable';
import type { ProductAction } from './ProductActions';
import { productDetailKey, readProductDetail } from './ProductQuery';

const tabs: readonly Readonly<{ key: ProductDrawerTab; label: string }>[] = Object.freeze([
  { key: 'overview', label: '概览' },
  { key: 'sku', label: 'SKU与库存' },
  { key: 'malls', label: '商城与售价' },
  { key: 'source', label: '来源与供货' },
  { key: 'changes', label: '变更记录' },
]);

interface ProductDrawerProps {
  readonly listing?: Listing;
  readonly onClose: () => void;
  readonly onAction: (action: ProductAction) => void;
}

export function ProductDrawer({ listing, onClose, onAction }: ProductDrawerProps) {
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
          {({ close }) => (listing === undefined ? null : <ProductDrawerContent key={listing.id} listing={listing} onClose={close} onAction={onAction} />)}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function ProductDrawerContent({
  listing,
  onClose,
  onAction,
}: Readonly<{
  listing: Listing;
  onClose: () => void;
  onAction: (action: ProductAction) => void;
}>) {
  const [tab, setTab] = useState<ProductDrawerTab>('overview');
  const context = useConsoleContext();
  const detail = useQuery({ queryKey: productDetailKey(context, listing.product_id), queryFn: ({ signal }) => readProductDetail(context, listing.product_id, signal), staleTime: 60_000 });
  return (
    <>
      <header className="productdrawerheader">
        <div className="productdraweridentity">
          <span className="productdrawerthumbnail" data-tone="neutral">
            {listing.cover_url == null || listing.cover_url === '' ? <ProductIcon name="cube" /> : <img src={listing.cover_url} alt="" />}
          </span>
          <div>
            <Heading slot="title">{listing.title}</Heading>
            <p>{listing.product_id}</p>
            <span className="productdrawermeta">
              <StatusBadge status={listing.status} />
              <small>v{listing.version}</small>
              <small>列表快照</small>
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
        <ProductDrawerPanels tab={tab} listing={listing} detail={detail.data} pending={detail.isPending} error={detail.error} />
      </div>
      <footer className="productdrawerfooter">
        <button type="button" onClick={onClose}>
          关闭
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onAction({ kind: listing.status === 'published' || listing.status === 'available' ? 'unpublish' : 'publish', listing });
          }}
        >
          {listing.status === 'published' || listing.status === 'available' ? '下架' : '上架'}
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onAction({ kind: 'price', listing });
          }}
        >
          设置价格
        </button>
        <button
          type="button"
          onClick={() => {
            onClose();
            onAction({ kind: 'archive', listing });
          }}
        >
          归档
        </button>
        <button
          className="productactionprimary"
          type="button"
          onClick={() => {
            onClose();
            onAction({ kind: 'edit', listing });
          }}
        >
          <ProductIcon name="edit" />
          编辑商品
        </button>
      </footer>
    </>
  );
}
