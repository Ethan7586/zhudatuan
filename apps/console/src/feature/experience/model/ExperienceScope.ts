import type { ScopeKind } from '@shop/authz';

export type CommerceWorkspaceMode = 'governance' | 'management' | 'design';

export interface CommerceScopePresentation {
  readonly mode: CommerceWorkspaceMode;
  readonly navigationLabel: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly primaryAction: string;
  readonly ownership: string;
  readonly ownershipDetail: string;
}

const governance: CommerceScopePresentation = Object.freeze({
  mode: 'governance',
  navigationLabel: '築店 · 应用治理',
  title: '应用治理',
  eyebrow: '智慧翼 · 商城治理',
  description: '跨商城查看应用、版本、发布状态、域名绑定与治理异常。',
  primaryAction: '查看准入边界',
  ownership: '平台治理视角',
  ownershipDetail: '平台只负责应用与商城准入，不代替商户创建、装修或自行审批。',
});

const management: CommerceScopePresentation = Object.freeze({
  mode: 'management',
  navigationLabel: '築店 · 商城管理',
  title: '商城管理',
  eyebrow: '智慧翼 · 商城运营',
  description: '创建、复制、进入和管理集团旗下商城，并跟踪开店与发布进度。',
  primaryAction: '创建商城',
  ownership: '集团建店视角',
  ownershipDetail: '集团负责建立商城及其初始商品池；完成后切换到新商城继续装修。',
});

const design: CommerceScopePresentation = Object.freeze({
  mode: 'design',
  navigationLabel: '築店 · 店铺装修',
  title: '店铺装修',
  eyebrow: '智慧翼 · 店铺装修',
  description: '管理页面、模板、导航、预览和发布，让当前商城形成完整消费入口。',
  primaryAction: '进入装修',
  ownership: '商城装修视角',
  ownershipDetail: '当前范围只管理本商城页面与发布版本，不越权修改集团或其他商城。',
});

export function experienceScopePresentation(kind: ScopeKind): CommerceScopePresentation {
  if (kind === 'platform' || kind === 'distributor') return governance;
  if (kind === 'mall') return design;
  return management;
}
