import { Brand, Button, WorkspaceHero } from '@shop/design';
import { OrderIcon } from './OrderIcon';

export function OrderPageHeader({
  isFetching,
  exportReady,
  onImport,
  onExport,
  onRefresh,
}: Readonly<{
  isFetching: boolean;
  exportReady: boolean;
  onImport: () => void;
  onExport: () => void;
  onRefresh: () => void;
}>) {
  return (
    <WorkspaceHero
      className="ordervi12hero"
      aria-labelledby="ordermanagementtitle"
      identity={<Brand inverse product="订单管理" variant="mark" />}
      eyebrow="OMS · 订单管理"
      title={<span id="ordermanagementtitle">订单管理系统</span>}
      description="集中查看订单状态、支付进度、履约和售后情况。"
      meta={
        <>
          <span>数据来源 · 订单服务</span>
          <span>当前模式 · 查看与筛选</span>
        </>
      }
      actions={
        <>
          <button className="shopbutton shopbuttondefault" type="button" title="选择本地 CSV 文件，本期不会上传" aria-describedby="orderwriteboundary" onClick={onImport}>
            <OrderIcon name="package" />
            导入
          </button>
          <button className="shopbutton shopbuttondefault" type="button" disabled={!exportReady} title={exportReady ? '仅导出当前已加载页，不包含其他分页' : '数据加载中'} aria-describedby="orderwriteboundary" onClick={onExport}>
            <OrderIcon name="download" />
            导出当前页
          </button>
          <Button type="button" tone="primary" onPress={onRefresh} isDisabled={isFetching}>
            <OrderIcon name="refresh" />
            {isFetching ? '刷新中' : '刷新数据'}
          </Button>
        </>
      }
    />
  );
}
