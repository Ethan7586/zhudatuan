export interface NavigationNodeValue {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly route: string;
  readonly component: string;
  readonly order: number;
  readonly entry: string;
  readonly disabled: boolean;
  readonly children: readonly NavigationNodeValue[];
}

export class NavigationNode implements NavigationNodeValue {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly route: string;
  readonly component: string;
  readonly order: number;
  readonly entry: string;
  readonly disabled: boolean;
  readonly children: readonly NavigationNodeValue[];

  constructor(value: Omit<NavigationNodeValue, 'children'> & { readonly children?: readonly NavigationNodeValue[] }) {
    if (!/^[a-z][a-z0-9]*$/.test(value.id) || !value.title.trim() || !value.route.startsWith('/')) throw new Error('NAVIGATION_NODE_INVALID');
    if (!Number.isSafeInteger(value.order) || value.order < 0) throw new Error('NAVIGATION_NODE_ORDER_INVALID');
    this.id = value.id;
    this.title = value.title;
    this.icon = value.icon;
    this.route = value.route;
    this.component = value.component;
    this.order = value.order;
    this.entry = value.entry;
    this.disabled = value.disabled;
    this.children = Object.freeze([...(value.children ?? [])]);
    Object.freeze(this);
  }
}
