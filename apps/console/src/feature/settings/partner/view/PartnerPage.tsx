import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { PartnerViewModel } from '../viewmodel/PartnerViewModel';
import { PartnerDialog } from './PartnerDialog';
import { PartnerDrawer } from './PartnerDrawer';
import { PartnerTable } from './PartnerTable';
import { StoreDialog } from './StoreDialog';
import { StoreTable } from './StoreTable';
import '../Partner.css';

export function PartnerPage({ title, model }: Readonly<{ title: string; model: PartnerViewModel }>) {
  const page = model.section === 'store' ? model.stores : model.partners;
  return (
    <>
      <ResourcePanel
        title={title}
        eyebrow={chineseSectionLabel('合作方管理')}
        description="供应商、品牌、门店及资质摘要来自合作方服务；所有写入均使用服务端版本和权威范围。"
        condition={model.condition}
        {...(model.error ? { error: model.error } : {})}
        retry={model.actions.refresh}
        actions={
          <div className="partneractions">
            {model.canManage ? (
              <Button tone="primary" onPress={model.actions.create}>
                新建{sectionLabel(model.section)}
              </Button>
            ) : null}
            <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
              {model.fetching ? '正在刷新…' : '刷新'}
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
            </nav>
            <section className="capabilitynote">
              <h2>{model.canManage ? '真实管理已开放' : '当前账号只有查看权限'}</h2>
              <p>{model.canManage ? '新建和编辑要求二次验证、CSRF、防重复提交、服务端版本和提交后重读；资质、历史协议与审核证据不会随状态变更删除。' : '写权限或能力不足时管理入口直接消失，前端状态不参与服务端授权。'}</p>
            </section>
          </>
        }
      >
        {page ? (
          <div className="featurestack">
            {model.section === 'store' && model.stores ? <StoreTable rows={model.stores.items} model={model} /> : model.partners ? <PartnerTable rows={model.partners.items} model={model} /> : null}
            <div className="pagination">
              <span>本页 {page.count} 条</span>
              <div>
                {model.cursor ? <Button onPress={model.actions.first}>返回第一页</Button> : null}
                {page.nextCursor ? <Button onPress={() => model.actions.next(page.nextCursor ?? '')}>下一页</Button> : null}
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
      <PartnerDrawer model={model} />
      <PartnerDialog model={model} />
      <StoreDialog model={model} />
    </>
  );
}

function sectionLabel(value: 'supplier' | 'brand' | 'store') {
  return value === 'supplier' ? '供应商' : value === 'brand' ? '品牌' : '门店';
}
