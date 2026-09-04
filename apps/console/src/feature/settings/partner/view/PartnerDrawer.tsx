import { Button, Drawer } from '@shop/design';
import { chineseDomainLabel, chineseReference } from '@shop/presentation';
import { formatDate } from '../../../../shared/ui/Format';
import type { PartnerViewModel } from '../viewmodel/PartnerViewModel';

export function PartnerDrawer({ model }: Readonly<{ model: PartnerViewModel }>) {
  const selection = model.selection;
  if (selection === undefined) return null;
  const item = selection.value;
  return (
    <Drawer open title={item.name} onClose={model.actions.closeDrawer}>
      <div className="partnerdetails">
        <dl>
          <div>
            <dt>状态</dt>
            <dd>{chineseDomainLabel(item.status)}</dd>
          </div>
          <div>
            <dt>所属范围</dt>
            <dd>{chineseReference('组织范围', item.scopeId)}</dd>
          </div>
          <div>
            <dt>服务端版本</dt>
            <dd>第 {item.version} 版</dd>
          </div>
          {'kind' in item ? (
            <>
              <div>
                <dt>类型</dt>
                <dd>{item.kind === 'supplier' ? '供应商' : '品牌'}</dd>
              </div>
              <div>
                <dt>有效资质</dt>
                <dd>{item.qualification.valid} 项</dd>
              </div>
              <div>
                <dt>待核验 / 驳回 / 过期</dt>
                <dd>
                  {item.qualification.pending} / {item.qualification.rejected} / {item.qualification.expired}
                </dd>
              </div>
              <div>
                <dt>最近到期</dt>
                <dd>{formatDate(item.qualification.nearestExpiry)}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>所属商城</dt>
                <dd>{item.mallId ? chineseReference('商城', item.mallId) : '未绑定商城'}</dd>
              </div>
              <div>
                <dt>服务区域</dt>
                <dd>{item.regionCode}</dd>
              </div>
              <div>
                <dt>服务半径</dt>
                <dd>{item.serviceRadiusMeters === null ? '未限制' : `${item.serviceRadiusMeters.toLocaleString('zh-CN')} 米`}</dd>
              </div>
              <div>
                <dt>地址状态</dt>
                <dd>{item.addressConfigured ? '已加密配置' : '未配置'}</dd>
              </div>
            </>
          )}
          <div>
            <dt>更新时间</dt>
            <dd>{formatDate(item.updatedAt)}</dd>
          </div>
        </dl>
        <p className="partnerprivacy">门店详细地址不会由读取接口回传；页面只展示是否已配置，更新时由服务端加密保存。</p>
        {model.canManage ? (
          <Button tone="primary" onPress={() => model.actions.edit(selection)}>
            编辑
          </Button>
        ) : null}
      </div>
    </Drawer>
  );
}
