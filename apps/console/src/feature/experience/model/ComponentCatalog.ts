import { EXPERIENCE_COMPONENTS, type ExperienceComponentType } from '@shop/contract';
import type { ExperienceBlock } from './Experience';

export interface ComponentDefinition {
  readonly type: ExperienceComponentType;
  readonly name: string;
  readonly description: string;
  readonly symbol: string;
}

const definitions = Object.freeze({
  hero: Object.freeze({ type: 'hero', name: '主视觉', description: '品牌标题、说明与主行动', symbol: '景' }),
  notice: Object.freeze({ type: 'notice', name: '公告', description: '展示重要经营通知', symbol: '告' }),
  shortcut: Object.freeze({ type: 'shortcut', name: '快捷入口', description: '最多八个常用服务入口', symbol: '捷' }),
  productcollection: Object.freeze({ type: 'productcollection', name: '商品集合', description: '引用已上架的商品集合', symbol: '品' }),
  richtext: Object.freeze({ type: 'richtext', name: '图文内容', description: '品牌故事与服务说明', symbol: '文' }),
} satisfies Readonly<Record<ExperienceComponentType, ComponentDefinition>>);

export const componentCatalog: readonly ComponentDefinition[] = Object.freeze(EXPERIENCE_COMPONENTS.map((type) => definitions[type]));

export function componentDefinition(type: ExperienceComponentType): ComponentDefinition {
  return definitions[type];
}

export function createComponent(type: ExperienceComponentType, id: string): ExperienceBlock {
  const content =
    type === 'hero'
      ? { title: '欢迎来到福利商城', subtitle: '企业福利，温暖抵达' }
      : type === 'notice'
        ? { announcement: '欢迎进入企业福利商城' }
        : type === 'shortcut'
          ? { title: '快捷服务', items: [{ id: `${id}:item:1`, label: '全部商品', icon: 'grid', action: { type: 'category', target: 'all' } }] }
          : type === 'productcollection'
            ? { title: '精选商品', collectionId: 'collection:featured', displayLimit: 4 }
            : { title: '品牌故事', content: '在这里介绍品牌与服务。' };
  return Object.freeze({ id, component: type, content: Object.freeze(content) });
}
