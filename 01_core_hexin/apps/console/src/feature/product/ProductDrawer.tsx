import { useEffect, useState } from 'react';
import { ProductDrawerPanels, type ProductDrawerTab } from './ProductDrawerPanels';
import { ProductIcon, type ProductIconName } from './ProductIcon';
import type { Listing } from './ProductSchema';
import { StatusBadge } from './ProductTable';

const tabs: readonly Readonly<{ key: ProductDrawerTab; label: string; icon: ProductIconName }>[] = Object.freeze([
  { key: 'overview', label: '商品概览', icon: 'inventory' },
  { key: 'sku', label: 'SKU与库存', icon: 'cube' },
  { key: 'malls', label: '商城与售价', icon: 'price' },
  { key: 'source', label: '来源与供货', icon: 'store' },
  { key: 'changes', label: '变更记录', icon: 'archive' },
]);

interface ProductDrawerProps {
  readonly listing?: Listing;
  readonly previewEnabled: boolean;
  readonly onClose: () => void;
}

export function ProductDrawer({ listing, previewEnabled, onClose }: ProductDrawerProps) {
  useEffect(() => {
    if (listing === undefined) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [listing, onClose]);

  if (listing === undefined) return null;
  return (
    <aside className="productdrawer" aria-label={`${listing.title} 商品详情`}>
      <ProductDrawerContent key={listing.id} listing={listing} previewEnabled={previewEnabled} onClose={onClose} />
    </aside>
  );
}

function ProductDrawerContent({ listing, previewEnabled, onClose }: Readonly<{
  listing: Listing;
  previewEnabled: boolean;
  onClose: () => void;
}>) {
  const [tab, setTab] = useState<ProductDrawerTab>('overview');
  const [copied, setCopied] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const preview = previewEnabled && listing.preview?.kind === 'console-product-v1' ? listing.preview : undefined;
  const productNumber = listing.code ?? listing.sku_id;
  const copyProductNumber = async () => {
    try {
      await navigator.clipboard.writeText(productNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="productdrawercontent">
      <header className="productdrawerheader">
        <div className="productdraweridentity">
          <span className="productdrawerthumbnail" data-tone={preview?.tone ?? 'neutral'}>
            {listing.cover_url == null || listing.cover_url === '' || coverFailed
              ? <ProductIcon name="cube" />
              : <img src={listing.cover_url} alt="" onError={() => setCoverFailed(true)} />}
          </span>
          <div>
            <h2>{listing.title}</h2>
            <div className="productdrawernumber">
              <span>{productNumber}</span>
              <button type="button" aria-label="复制商品编号" onClick={() => { void copyProductNumber(); }}><ProductIcon name="copy" /></button>
              {copied ? <em role="status">已复制</em> : null}
            </div>
            <span className="productdrawermeta">
              <StatusBadge status={listing.management_status ?? listing.status} />
              <small>版本 v{listing.version}</small>
              <small>供应商：{preview?.supplier.name ?? '待同步'}</small>
              <small>更新于 {formatDateTime(listing.cursor_sort)}</small>
            </span>
          </div>
        </div>
        <div className="productdraweractions">
          <button className="producteditaction" type="button" disabled title="当前商品编辑能力尚未开放"><ProductIcon name="edit" />编辑商品</button>
          <button className="productdrawerclose" type="button" aria-label="关闭商品详情" onClick={onClose}><ProductIcon name="close" /></button>
        </div>
      </header>
      <div className="productdrawertabs" role="tablist" aria-label="商品详情">
        {tabs.map((item) => (
          <button key={item.key} id={`producttab-${item.key}`} type="button" role="tab" aria-selected={tab === item.key}
            aria-controls="productdrawerpanel" onClick={() => setTab(item.key)}>
            <i aria-hidden="true"><ProductIcon name={item.icon} /></i><span>{item.label}</span>
          </button>
        ))}
      </div>
      <div id="productdrawerpanel" className="productdrawerbody" role="tabpanel" aria-labelledby={`producttab-${tab}`}>
        <ProductDrawerPanels tab={tab} listing={listing} {...(preview === undefined ? {} : { preview })} onResolve={() => setTab('malls')} />
      </div>
      <footer className="productdrawerfooter">
        <span>当前仅开放商品查看与货架操作</span>
        <button type="button" onClick={onClose}>关闭详情</button>
        <button className="productactionprimary" type="button" disabled title="当前商品编辑能力尚未开放"><ProductIcon name="edit" />编辑商品</button>
      </footer>
    </div>
  );
}

function formatDateTime(value: string | undefined): string {
  if (value === undefined || value === '') return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}
