const CATEGORY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  'virtual-card': '电子卡券',
  virtual_card: '电子卡券',
  cat_virtual: '电子卡券',
  food: '食品饮料',
  cat_food: '食品饮料',
  appliance: '家用电器',
  cat_appliance: '家用电器',
  digital: '数码办公',
  cat_digital: '数码办公',
  home: '家居日用',
  cat_home: '家居日用',
  personal: '个护清洁',
  cat_personal: '个护清洁',
  movie: '电影票券',
  cat_movie: '电影票券',
  supermarket: '商超到家',
  cat_supermarket: '商超到家',
  life: '生活服务',
  cat_life: '生活服务',
  cat_welfare_zone: '员工精选',
});

export function categoryName(name: string, code: string): string {
  const visible = name.trim();
  const mapped = CATEGORY_NAMES[code.trim().toLowerCase()] ?? CATEGORY_NAMES[visible.toLowerCase()];
  if (mapped) return mapped;
  return /[\u3400-\u9fff]/u.test(visible) ? visible : '其他福利';
}
