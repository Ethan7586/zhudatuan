import type { ExperienceDocument } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { ComponentTree, type ComponentIssue } from '../value/ComponentTree';
import type { PublishEvidence } from '../value/PublishEvidence';
import { Theme } from '../value/Theme';

export class PublishPolicy {
  evaluate(document: ExperienceDocument, evidence: PublishEvidence): readonly ComponentIssue[] {
    Theme.create(document.theme);
    const issues = [...ComponentTree.create(document).issues(), ...evidence.issues];
    for (const [name, dependency] of Object.entries(evidence.dependencies)) {
      if (!dependency.ready) issues.push(Object.freeze({ code: dependencyCode(name), path: dependencyPath(name), message: dependencyMessage(name) }));
    }
    for (const [pageIndex, page] of document.pages.entries()) {
      for (const [blockIndex, block] of page.blocks.entries()) {
        if (block.action && !safeTarget(block.action.type, block.action.target)) {
          issues.push(Object.freeze({ code: 'ACTION_TARGET_INVALID', path: `pages.${pageIndex}.blocks.${blockIndex}.action.target`, message: '组件跳转目标不安全或格式不正确' }));
        }
      }
    }
    return Object.freeze(unique(issues));
  }

  assertPublishable(issues: readonly ComponentIssue[]): void {
    if (issues.length > 0) throw new DomainError('EXPERIENCE_PUBLICATION_INVALID', { issues });
  }
}

function safeTarget(type: string, target: string): boolean {
  if (type === 'link') return /^\/(?:page|pages)\/[a-z0-9/-]+(?:\?[a-z0-9&=_-]+)?$/i.test(target);
  return /^[a-zA-Z0-9:._/-]{1,255}$/.test(target);
}
function dependencyCode(value: string): string {
  return `${value.toUpperCase()}_DEPENDENCY_INVALID`;
}
function dependencyPath(value: string): string {
  if (value === 'pool') return 'bindings.pool';
  if (value === 'channel') return 'channels';
  if (value === 'domain') return 'domain';
  if (value === 'resources') return 'assets';
  return `dependencies.${value}`;
}
function dependencyMessage(value: string): string {
  return (
    {
      catalog: '商品池中的商品或类目引用不可用',
      marketing: '营销活动引用不可用',
      pool: '商城尚未绑定可发布商品池',
      qualification: '商品资格规则未就绪',
      pricing: '商品缺少有效报价',
      inventory: '商品缺少可售库存',
      resources: '图片或资源不存在、未通过扫描或摘要不可信',
      domain: '商城域名配置不完整',
      capabilities: '商城缺少发布所需能力',
      channel: '发布渠道配置不完整',
    }[value] ?? '发布依赖不可用'
  );
}
function unique(issues: readonly ComponentIssue[]): ComponentIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.code}:${issue.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
