const GENERIC_CATEGORY_TERMS: Record<string, string[]> = {
  cat_food: ['食品', '饮料', '粮油'],
  cat_appliance: ['家电', '电器'],
  cat_digital: ['数码', '办公'],
  cat_home: ['家居', '日用'],
  cat_personal: ['个护', '洗护'],
  cat_supermarket: ['商超'],
  cat_apparel: ['服饰', '鞋包'],
  cat_welfare_zone: ['企业福利', '员工福利', '福利专区'],
};

const SYNONYM_INDEX: Record<string, string[]> = {
  福利: ['补贴', '权益', '专享', '补贴卡'],
  餐卡: ['饭卡', '工作餐', '就餐卡', '餐饮卡'],
  电影: ['电影票', '影票', '通兑'],
  礼盒: ['礼品', '礼包', '礼券'],
  奶茶: ['奶饮', '拿铁', '咖啡'],
  大米: ['米', '米面', '粮油'],
};

const SEARCH_SEPARATORS = /[\s\-_/。，,·:；;!！?？]/g;

export function getGenericCategoryTerms() {
  return GENERIC_CATEGORY_TERMS;
}

export function normalizeText(value: string) {
  return value.toLowerCase().replace(SEARCH_SEPARATORS, '').trim();
}

export function expandSearchKeyword(keyword: string) {
  const base = keyword.trim().toLowerCase();
  if (!base) return [];
  const expansions = new Set<string>([base, normalizeText(base)]);

  Object.entries(SYNONYM_INDEX).forEach(([indexWord, aliases]) => {
    const indexWordNormalized = normalizeText(indexWord);
    if (base.includes(indexWord) || base.includes(indexWordNormalized)) {
      aliases.forEach((alias) => {
        expansions.add(alias);
        expansions.add(normalizeText(alias));
      });
    }
  });

  return Array.from(expansions).filter(Boolean);
}
