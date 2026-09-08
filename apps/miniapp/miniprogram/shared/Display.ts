export interface MiniappDisplayItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly updated_at?: string;
}

export function displayItem(id: string, title: string, description: string, status: string, updatedAt?: string | null): MiniappDisplayItem {
  return Object.freeze({ id, title, description, status, ...(updatedAt ? { updated_at: updatedAt } : {}) });
}

export function displayPage(...groups: readonly (readonly MiniappDisplayItem[])[]): Readonly<{ items: readonly MiniappDisplayItem[]; count: number }> {
  const items = Object.freeze(groups.flat());
  return Object.freeze({ items, count: items.length });
}

export function money(minor: number, currency = 'CNY'): string {
  return currency === 'CNY' ? `¥${(minor / 100).toFixed(2)}` : `${(minor / 100).toFixed(2)} ${currency}`;
}
