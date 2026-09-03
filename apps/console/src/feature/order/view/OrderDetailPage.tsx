import { chineseDomainLabel, chineseReference, chineseSectionLabel } from '@shop/presentation';
import { Button, DataTable, MetricGrid, ResourcePanel, type DataColumn } from '@shop/design';
import { formatDate, formatMinor } from '../../../shared/ui/Format';
import type { OrderLine } from '../model/Order';
import type { DetailViewModel } from '../viewmodel/DetailViewModel';
import { OrderDrawerPanel } from './OrderDrawerPanel';

const columns: readonly DataColumn<OrderLine>[] = [
  { key: 'title', label: '商品', render: (row) => row.title },
  { key: 'sku', label: '商品规格', render: (row) => chineseReference('规格', row.sku) },
  { key: 'quantity', label: '数量', render: (row) => row.quantity },
  { key: 'unit', label: '单价快照', render: (row) => formatMinor(row.unitMinor) },
  { key: 'discount', label: '优惠快照', render: (row) => formatMinor(row.discountMinor) },
  { key: 'payable', label: '应付快照', render: (row) => formatMinor(row.payableMinor) },
];

export function OrderDetailPage({ title, viewmodel }: Readonly<{ title: string; viewmodel: DetailViewModel }>) {
  const data = viewmodel.data;
  return (
    <ResourcePanel
      title={title}
      eyebrow={chineseSectionLabel('订单详情')}
      description={`${chineseReference('订单', viewmodel.reference ?? '')}的支付、履约、退款、脱敏地址与审计权威快照。`}
      condition={viewmodel.condition}
      {...(viewmodel.error === undefined ? {} : { error: viewmodel.error })}
      retry={viewmodel.refresh}
      actions={<Button onPress={viewmodel.refresh}>刷新订单</Button>}
    >
      {data === undefined ? <span /> : (
        <div className="featurestack">
          <MetricGrid items={[
            { label: '订单号', value: data.order_number },
            { label: '服务端应付', value: formatMinor(data.total_minor, data.currency) },
            { label: '支付状态', value: chineseDomainLabel(data.payment_state) },
            { label: '履约状态', value: chineseDomainLabel(data.fulfillment_state) },
            { label: '售后状态', value: chineseDomainLabel(data.aftersale_state) },
            { label: '版本', value: `第 ${data.version} 版`, detail: formatDate(data.updated_at) },
          ]} />
          <OrderDrawerPanel order={data} tab="overview" />
          <DataTable caption="订单商品明细" columns={columns} rows={data.lines} rowKey={(row) => row.id} />
        </div>
      )}
    </ResourcePanel>
  );
}
