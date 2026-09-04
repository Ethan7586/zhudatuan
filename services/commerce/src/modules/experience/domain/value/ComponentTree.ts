import type { ExperienceDocument } from '@shop/contract';

export interface ComponentIssue extends Readonly<Record<string, string>> {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}
export interface ComponentResource {
  readonly reference: string;
  readonly path: string;
}

export class ComponentTree {
  private constructor(private readonly document: ExperienceDocument) {
    Object.freeze(this);
  }

  static create(document: ExperienceDocument): ComponentTree {
    return new ComponentTree(document);
  }

  issues(): readonly ComponentIssue[] {
    const issues: ComponentIssue[] = [];
    const pageIds = new Set<string>();
    const paths = new Set<string>();
    const blocks = new Set<string>();
    for (const [index, page] of this.document.pages.entries()) {
      if (pageIds.has(page.id)) issue(issues, 'PAGE_ID_DUPLICATE', `pages.${index}.id`, '页面编号不可重复');
      if (paths.has(page.path)) issue(issues, 'PAGE_PATH_DUPLICATE', `pages.${index}.path`, '页面路径不可重复');
      if (!/^[a-z0-9][a-z0-9/-]{0,127}$/.test(page.path)) issue(issues, 'PAGE_PATH_INVALID', `pages.${index}.path`, '页面路径格式不正确');
      pageIds.add(page.id);
      paths.add(page.path);
      for (const [blockIndex, block] of page.blocks.entries()) {
        if (blocks.has(block.id)) issue(issues, 'BLOCK_ID_DUPLICATE', `pages.${index}.blocks.${blockIndex}.id`, '组件编号不可重复');
        blocks.add(block.id);
      }
      for (const [component, maximum] of Object.entries({ hero: 4, notice: 6, shortcut: 4, productcollection: 16, richtext: 8 })) {
        if (page.blocks.filter((block) => block.component === component).length > maximum) {
          issue(issues, 'COMPONENT_LIMIT_EXCEEDED', `pages.${index}.blocks`, `${component} 组件数量超过单页上限 ${maximum}`);
        }
      }
    }
    if (!paths.has('home')) issue(issues, 'HOME_PAGE_REQUIRED', 'pages', '必须配置首页');
    for (const [index, item] of this.document.navigation.entries()) {
      if (!pageIds.has(item.page) && !paths.has(item.page)) issue(issues, 'NAVIGATION_PAGE_MISSING', `navigation.${index}.page`, '菜单指向的页面不存在');
    }
    return Object.freeze(issues);
  }

  resources(): readonly string[] {
    return Object.freeze([...new Set(this.resourceReferences().map(({ reference }) => reference))].sort());
  }

  resourceReferences(): readonly ComponentResource[] {
    const values: ComponentResource[] = this.document.assets.map((reference, index) => Object.freeze({ reference, path: `assets.${index}` }));
    if (this.document.theme.logoObjectRef) values.push(Object.freeze({ reference: this.document.theme.logoObjectRef, path: 'theme.logoObjectRef' }));
    if (this.document.theme.faviconObjectRef) values.push(Object.freeze({ reference: this.document.theme.faviconObjectRef, path: 'theme.faviconObjectRef' }));
    for (const [pageIndex, page] of this.document.pages.entries()) {
      for (const [blockIndex, block] of page.blocks.entries()) {
        for (const field of ['image', 'objectRef'] as const) {
          const reference = block.content[field];
          if (typeof reference === 'string') values.push(Object.freeze({ reference, path: `pages.${pageIndex}.blocks.${blockIndex}.content.${field}` }));
        }
      }
    }
    const unique = new Map(values.map((value) => [value.reference, value]));
    return Object.freeze([...unique.values()].sort((left, right) => left.reference.localeCompare(right.reference)));
  }

  snapshot(): ExperienceDocument {
    return this.document;
  }
}

function issue(target: ComponentIssue[], code: string, path: string, message: string): void {
  target.push(Object.freeze({ code, path, message }));
}
