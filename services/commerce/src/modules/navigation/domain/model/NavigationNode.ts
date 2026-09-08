export interface NavigationBreadcrumb {
  readonly key: string;
  readonly title: string;
}

export interface NavigationExperience {
  readonly icon: string;
  readonly routeKey: string;
  readonly route: string;
  readonly component: string;
  readonly placement: 'primary' | 'secondary' | 'contextual';
  readonly disabled: boolean;
  readonly disabledReason: string | null;
  readonly breadcrumbs: readonly NavigationBreadcrumb[];
}

export interface NavigationNodeValue {
  readonly key: string;
  readonly title: string;
  readonly parent: string | null;
  readonly order: number;
  readonly operation: string;
  readonly experience: NavigationExperience;
  readonly children: readonly NavigationNodeValue[];
}

export class NavigationNode implements NavigationNodeValue {
  readonly key: string;
  readonly title: string;
  readonly parent: string | null;
  readonly order: number;
  readonly operation: string;
  readonly experience: NavigationExperience;
  readonly children: readonly NavigationNodeValue[];

  constructor(value: Omit<NavigationNodeValue, 'children'> & { readonly children?: readonly NavigationNodeValue[] }) {
    if (!validKey(value.key) || (value.parent !== null && !validKey(value.parent))) throw new Error('NAVIGATION_NODE_KEY_INVALID');
    if (!chineseTitle(value.title)) throw new Error('NAVIGATION_NODE_TITLE_INVALID');
    if (!Number.isSafeInteger(value.order) || value.order < 0) throw new Error('NAVIGATION_NODE_ORDER_INVALID');
    if (!/^[a-z]+(?:\.[a-z]+)+$/.test(value.operation)) throw new Error('NAVIGATION_NODE_OPERATION_INVALID');
    validateExperience(value.experience, value.key, value.title);
    this.key = value.key;
    this.title = value.title.trim();
    this.parent = value.parent;
    this.order = value.order;
    this.operation = value.operation;
    this.experience = Object.freeze({
      ...value.experience,
      breadcrumbs: Object.freeze(value.experience.breadcrumbs.map((item) => Object.freeze({ ...item }))),
    });
    this.children = Object.freeze((value.children ?? []).map((child) => new NavigationNode(child)));
    Object.freeze(this);
  }

  toValue(): NavigationNodeValue {
    return Object.freeze({
      key: this.key,
      title: this.title,
      parent: this.parent,
      order: this.order,
      operation: this.operation,
      experience: Object.freeze({
        ...this.experience,
        breadcrumbs: Object.freeze(this.experience.breadcrumbs.map((item) => Object.freeze({ ...item }))),
      }),
      children: Object.freeze(this.children.map((child) => (child instanceof NavigationNode ? child.toValue() : new NavigationNode(child).toValue()))),
    });
  }
}

function validateExperience(value: NavigationExperience, key: string, title: string): void {
  if (
    !/^[a-z][a-z0-9]*$/.test(value.icon) ||
    !validKey(value.routeKey) ||
    !value.route.startsWith('/') ||
    value.route.includes('?') ||
    value.route.includes('#') ||
    !validKey(value.component) ||
    !['primary', 'secondary', 'contextual'].includes(value.placement)
  ) {
    throw new Error('NAVIGATION_NODE_EXPERIENCE_INVALID');
  }
  if ((value.disabled && !chineseTitle(value.disabledReason ?? '')) || (!value.disabled && value.disabledReason !== null)) throw new Error('NAVIGATION_NODE_DISABLED_REASON_INVALID');
  const leaf = value.breadcrumbs.at(-1);
  if (value.breadcrumbs.length === 0 || leaf?.key !== key || leaf.title !== title || value.breadcrumbs.some((item) => !validKey(item.key) || !chineseTitle(item.title))) {
    throw new Error('NAVIGATION_NODE_BREADCRUMB_INVALID');
  }
}

function validKey(value: string): boolean {
  return /^[a-z][a-z0-9]*$/.test(value);
}

function chineseTitle(value: string): boolean {
  return value.trim().length > 0 && value.length <= 80 && /\p{Script=Han}/u.test(value);
}
