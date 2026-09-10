import type { OperationId } from '@shop/contract';
import {
  OP_CATALOG_LISTINGS_POOL_SET,
  OP_CATALOG_LISTINGS_PRICE_SET,
  OP_CATALOG_LISTINGS_PUBLISH,
  OP_CATALOG_LISTINGS_UNPUBLISH,
  OP_CATALOG_POOLS_ATTACH,
  OP_CATALOG_PRODUCT_DETAIL_READ,
  OP_CATALOG_PRODUCTS_ARCHIVE,
  OP_CATALOG_PRODUCTS_UPDATE,
  OP_INVENTORY_IMPORTS_CREATE,
  OP_INVENTORY_AVAILABILITY_READ,
  OP_RUNTIME_IMPORTS_CONFIRM,
  OP_RUNTIME_IMPORTS_READ,
  OP_RUNTIME_UPLOADS_CREATE,
  OP_QUALIFICATION_CENTER_READ,
} from '@shop/contract/ids';
import { Button, type ButtonTone } from '@shop/design';
import { editableProductStatus } from '@shop/presentation';
import type { Listing, ProductDetail } from '../model/Product';
import type { ProductAction } from '../model/ProductAction';
import { canChangeListingPublication, isManagedListing, isPublishedListing, productVersion } from '../model/ProductAction';
import type { ProductJourney, ProductJourneyAction } from '../model/ProductJourney';
import type { ProductDetailViewModel } from '../viewmodel/ProductDetailViewModel';

export interface ProductDrawerActionsProps {
  readonly listing: Listing;
  readonly detail?: ProductDetail;
  readonly sections: ProductDetailViewModel['sections'];
  readonly journey: ProductJourney;
  readonly onClose: () => void;
  readonly onDetail: (listing: Listing) => void;
  readonly onAction: (action: ProductAction) => void;
  readonly onPool: (listing: Listing, intent?: 'move' | 'deliver') => void;
  readonly onInventory: (listing: Listing) => void;
  readonly onQualification: (listing: Listing) => void;
  readonly canUse: (operation: OperationId) => boolean;
}

interface DrawerCommand {
  readonly key: ProductJourneyAction | 'edit' | 'archive' | 'unpublish';
  readonly label: string;
  readonly tone?: ButtonTone;
  readonly disabled: boolean;
  readonly reason?: string;
  readonly run: () => void;
}

export function ProductDrawerActions(props: ProductDrawerActionsProps) {
  const commands = productCommands(props);
  const primaryAction = props.journey.complete ? 'inventory' : props.journey.next.action;
  const primary = commands.find(({ key }) => key === primaryAction) ?? commands.find(({ key }) => key === 'detail');
  const secondary = commands.filter(({ key }) => key !== primary?.key && !(key === 'unpublish' && !isPublishedListing(props.listing.status)));
  const primaryCopy = props.journey.complete ? Object.freeze({ label: '补充库存', detail: '直接填写本次入库数量，商品保持上架，无需准备表格。' }) : props.journey.next;
  return (
    <footer className="productdrawerfooter">
      <div className="productdrawernextcopy">
        <span>{props.journey.complete ? '常用维护' : '建议下一步'}</span>
        <strong>{primaryCopy.label}</strong>
        <small>{primaryCopy.detail}</small>
      </div>
      <div className="productdrawerfooteractions">
        <details className="productmoreactions">
          <summary>更多操作</summary>
          <div role="group" aria-label="更多商品操作">
            {secondary.map((command) => (
              <span key={command.key} className="productcommandhint" {...(command.reason === undefined ? {} : { title: command.reason })}>
                <Button tone={command.tone ?? 'default'} onPress={command.run} isDisabled={command.disabled}>
                  {command.label}
                </Button>
              </span>
            ))}
          </div>
        </details>
        {primary === undefined ? null : (
          <span className="productcommandhint productnextaction" {...(primary.reason === undefined ? {} : { title: primary.reason })}>
            <Button tone="primary" onPress={primary.run} isDisabled={primary.disabled}>
              {primary.label}
            </Button>
          </span>
        )}
      </div>
    </footer>
  );
}

function productCommands({ listing, detail, sections, onClose, onDetail, onAction, onPool, onInventory, onQualification, canUse }: ProductDrawerActionsProps): readonly DrawerCommand[] {
  const managed = isManagedListing(listing);
  const hasProduct = typeof listing.product_id === 'string' && listing.product_id !== '';
  const published = isPublishedListing(listing.status);
  const expectedVersion = sections.core.condition === 'ready' ? productVersion(detail?.version) : undefined;
  const currentPrice = sections.pricing.condition === 'ready' ? sections.pricing.data?.prices.find((item) => item.scope === listing.scope_id && item.sku === listing.sku_id) : undefined;
  const priceVersion = sections.pricing.condition === 'ready' ? (currentPrice === undefined ? 0 : productVersion(currentPrice.priceVersion)) : undefined;
  const productReady = expectedVersion !== undefined && hasProduct;
  const poolReady = managed && listing.status !== 'published' && listing.status !== 'retired';
  const deliveryReady = managed && typeof listing.pool_id === 'string' && listing.pool_id !== '';
  const publicationOperation = published ? OP_CATALOG_LISTINGS_UNPUBLISH : OP_CATALOG_LISTINGS_PUBLISH;
  const publicationAllowed = canUse(publicationOperation);
  const inventoryAllowed = [OP_INVENTORY_AVAILABILITY_READ, OP_INVENTORY_IMPORTS_CREATE, OP_RUNTIME_UPLOADS_CREATE, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_IMPORTS_CONFIRM].every(canUse);
  const canPublish = publicationAllowed && managed && canChangeListingPublication(listing.status, detail?.status);
  const run = (command: () => void) => () => {
    onClose();
    command();
  };
  return Object.freeze([
    command(
      'detail',
      '查看完整详情',
      !hasProduct || !canUse(OP_CATALOG_PRODUCT_DETAIL_READ),
      !hasProduct ? '渠道商品尚未映射到商品主档' : '当前账号没有查看完整商品详情的权限。',
      run(() => onDetail(listing))
    ),
    command(
      'edit',
      '编辑商品资料',
      !productReady || !canUse(OP_CATALOG_PRODUCTS_UPDATE),
      !hasProduct ? '渠道商品尚未映射到商品主档' : !canUse(OP_CATALOG_PRODUCTS_UPDATE) ? '当前账号没有编辑商品的权限。' : '正在读取商品主档版本',
      run(() => onAction({ operation: OP_CATALOG_PRODUCTS_UPDATE, listing, status: editableProductStatus(detail?.status), expectedVersion: expectedVersion! }))
    ),
    command(
      'pool',
      managed && listing.pool_id !== null ? '调整商品池' : '加入商品池',
      !poolReady || !canUse(OP_CATALOG_LISTINGS_POOL_SET),
      !canUse(OP_CATALOG_LISTINGS_POOL_SET) ? '当前账号没有调整商品池的权限。' : !managed ? '渠道商品尚未映射，不能调整商品池' : listing.status === 'published' ? '请先下架商品再调整商品池' : '已归档商品不能调整商品池',
      run(() => onPool(listing, 'move'))
    ),
    command(
      'deliver',
      '投放到商城',
      !deliveryReady || !canUse(OP_CATALOG_POOLS_ATTACH),
      !canUse(OP_CATALOG_POOLS_ATTACH) ? '当前账号没有商城投放权限。' : !deliveryReady ? '请先把商品加入商品池。' : undefined,
      run(() => onPool(listing, 'deliver'))
    ),
    command(
      'price',
      '设置售价',
      priceVersion === undefined || !canUse(OP_CATALOG_LISTINGS_PRICE_SET),
      !canUse(OP_CATALOG_LISTINGS_PRICE_SET) ? '当前账号没有设置商品价格的权限。' : '正在读取当前售价版本',
      run(() => onAction({ operation: OP_CATALOG_LISTINGS_PRICE_SET, listing, expectedVersion: priceVersion! }))
    ),
    command('inventory', '补充库存', !inventoryAllowed || listing.sku_id === null, listing.sku_id === null ? '当前商品还没有可补货的规格，请先完善商品规格。' : '当前账号缺少查看库存、补充库存或确认库存任务的权限。', () =>
      onInventory(listing)
    ),
    command(
      'qualification',
      '完善售卖资格',
      !canUse(OP_QUALIFICATION_CENTER_READ),
      '当前账号没有查看资格中心的权限。',
      run(() => onQualification(listing))
    ),
    command(
      published ? 'unpublish' : 'publish',
      published ? '下架商品' : '确认上架',
      !canPublish,
      !publicationAllowed ? '当前账号没有上架或下架商品的权限。' : !managed ? '渠道商品尚未映射，不能直接上架或下架' : '请先把商品状态设为启用',
      run(() => onAction({ operation: publicationOperation, listing }))
    ),
    command(
      'archive',
      '归档商品',
      !productReady || !canUse(OP_CATALOG_PRODUCTS_ARCHIVE),
      !hasProduct ? '渠道商品尚未映射到商品主档' : !canUse(OP_CATALOG_PRODUCTS_ARCHIVE) ? '当前账号没有归档商品的权限。' : '正在读取商品主档版本',
      run(() => onAction({ operation: OP_CATALOG_PRODUCTS_ARCHIVE, listing, expectedVersion: expectedVersion! })),
      'danger'
    ),
  ]);
}

function command(key: DrawerCommand['key'], label: string, disabled: boolean, reason: string | undefined, run: () => void, tone?: ButtonTone): DrawerCommand {
  return Object.freeze({ key, label, disabled, ...(disabled && reason !== undefined ? { reason } : {}), run, ...(tone === undefined ? {} : { tone }) });
}
