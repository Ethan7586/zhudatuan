import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { PartnerViewModel } from '../viewmodel/PartnerViewModel';
import { PartnerDialog } from './PartnerDialog';
import type { PartnerSection } from '../model/PartnerEditor';
import { PartnerDrawer } from './PartnerDrawer';
import { PartnerTable } from './PartnerTable';
import { StoreDialog } from './StoreDialog';
import { StoreTable } from './StoreTable';
import type { CustomerViewModel } from '../viewmodel/CustomerViewModel';
import { CustomerDialog } from './CustomerDialog';
import { CustomerDrawer } from './CustomerDrawer';
import { CustomerFilters } from './CustomerFilters';
import { CustomerTable } from './CustomerTable';
import '../Partner.css';

export function PartnerPage({ title, model, customer }: Readonly<{ title: string; model: PartnerViewModel; customer: CustomerViewModel }>) {
  const customerSection = model.section === 'customer';
  const page = customerSection ? customer.page : model.section === 'store' ? model.stores : model.partners;
  const error = customerSection ? customer.error : model.error;
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('合作方管理')}
        description="供应商、品牌、门店及资质摘要来自合作方服务；所有写入均使用服务端版本和权威范围。"
        condition={customerSection ? customer.condition : model.condition}
        {...(error ? { error } : {})}
        retry={customerSection ? customer.actions.refresh : model.actions.refresh}
        actions={
          <div className="partneractions">
            {customerSection && customer.access.canCreate ? <Button tone="primary" onPress={customer.actions.create}>新建客户</Button> : null}
            {!customerSection && model.canManage ? (
              <Button tone="primary" onPress={model.actions.create}>
                新建{sectionLabel(model.section)}
              </Button>
            ) : null}
            <Button onPress={customerSection ? customer.actions.refresh : model.actions.refresh} isDisabled={customerSection ? customer.fetching : model.fetching}>
              {(customerSection ? customer.fetching : model.fetching) ? '正在刷新…' : '刷新'}
            </Button>
          </div>
        }
        notice={
          <>
            <nav className="partnersections" aria-label="合作方类型">
              <Button tone={model.section === 'supplier' ? 'primary' : 'default'} aria-pressed={model.section === 'supplier'} onPress={() => model.actions.section('supplier')}>
                供应商
              </Button>
              <Button tone={model.section === 'brand' ? 'primary' : 'default'} aria-pressed={model.section === 'brand'} onPress={() => model.actions.section('brand')}>
                品牌
              </Button>
              <Button tone={model.section === 'store' ? 'primary' : 'default'} aria-pressed={model.section === 'store'} onPress={() => model.actions.section('store')}>
                门店
              </Button>
              {customer.access.canList ? <Button tone={customerSection ? 'primary' : 'default'} aria-pressed={customerSection} onPress={() => model.actions.section('customer')}>客户</Button> : null}
            </nav>
            <section className="capabilitynote">
              <h2>{customerSection ? '客户字段权限与状态影响已生效' : model.canManage ? '真实管理已开放' : '当前账号只有查看权限'}</h2>
              <p>{customerSection ? '识别号和联系人只展示脱敏值；新增、编辑、启用、停用分别受精确 Operation 权限控制，停用前先展示对下游业务的影响。' : model.canManage ? '新建和编辑要求二次验证、CSRF、防重复提交、服务端版本和提交后重读；资质、历史协议与审核证据不会随状态变更删除。' : '写权限或能力不足时管理入口直接消失，前端状态不参与服务端授权。'}</p>
            </section>
          </>
        }
      >
        {page ? (
          <div className="featurestack">
            {customerSection && customer.page ? <><CustomerFilters model={customer} /><CustomerTable rows={customer.page.items} model={customer} /></> : model.section === 'store' && model.stores ? <StoreTable rows={model.stores.items} model={model} /> : model.partners ? <PartnerTable rows={model.partners.items} model={model} /> : null}
            <div className="pagination">
              <span>本页 {page.count} 条</span>
              <div>
                {(customerSection ? customer.query.cursor : model.cursor) ? <Button onPress={customerSection ? customer.actions.first : model.actions.first}>返回第一页</Button> : null}
                {page.nextCursor ? <Button onPress={() => customerSection ? customer.actions.next(page.nextCursor ?? '') : model.actions.next(page.nextCursor ?? '')}>下一页</Button> : null}
              </div>
            </div>
          </div>
        ) : null}
      </ResourcePanel>
      {model.receipt ? (
        <section className="partnerreceipt" role="status">
          <strong>保存成功</strong>
          <span>
            {sectionLabel(model.receipt.kind)} {model.receipt.id} 已写入服务端，第 {model.receipt.version} 版。
          </span>
          <Button onPress={model.actions.dismissReceipt}>知道了</Button>
        </section>
      ) : null}
      {customer.receipt ? <section className="partnerreceipt" role="status"><strong>客户已保存</strong><span>“{customer.receipt.name}”已写入服务端，第 {customer.receipt.version} 版。</span><Button onPress={customer.actions.dismissReceipt}>知道了</Button></section> : null}
      <PartnerDrawer model={model} />
      <PartnerDialog model={model} />
      <StoreDialog model={model} />
      <CustomerDrawer model={customer} />
      <CustomerDialog model={customer} />
    </>
  );
}

function sectionLabel(value: PartnerSection) {
  return value === 'supplier' ? '供应商' : value === 'brand' ? '品牌' : value === 'customer' ? '客户' : '门店';
}
