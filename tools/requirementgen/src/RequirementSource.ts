export interface SheetDefinition {
  readonly name: string;
  readonly label: string;
  readonly prefix: string;
  readonly rows: readonly number[];
  readonly level: string;
  readonly role: string;
  readonly scope: string;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly label: string;
  readonly priority: 1 | 3 | 4;
  readonly vendor?: string;
}

const range = (start: number, end: number): readonly number[] =>
  Object.freeze(Array.from({ length: end - start + 1 }, (_, index) => start + index));

export const SHEETS: readonly SheetDefinition[] = Object.freeze([
  { name: '1-平台层', label: '平台层', prefix: 'PLAT', rows: range(4, 71), level: 'platform', role: 'platformoperator', scope: 'platform' },
  { name: '2-分销层', label: '分销层', prefix: 'DIST', rows: range(4, 44), level: 'distribution', role: 'distributoroperator', scope: 'distributor' },
  { name: '3-集团', label: '集团', prefix: 'GROUP', rows: range(4, 71), level: 'enterprise', role: 'enterpriseoperator', scope: 'enterprise' },
  { name: '4-、商城', label: '商城', prefix: 'MALL', rows: range(4, 56).filter((row) => row !== 54), level: 'mall', role: 'malloperator', scope: 'mall' },
  { name: '门店后台', label: '门店后台', prefix: 'STORE', rows: range(4, 23), level: 'store', role: 'storeoperator', scope: 'store' },
  { name: '供应链后台', label: '供应链后台', prefix: 'SUPPLY', rows: range(4, 24).filter((row) => row !== 22), level: 'partner', role: 'supplieroperator', scope: 'partner' },
  { name: '供应链平台', label: '供应链平台', prefix: 'CHAIN', rows: [7, 8, 10, 11, 12, 13, 14], level: 'platform', role: 'platformoperator', scope: 'platform' },
  { name: '接口', label: '接口', prefix: 'INTEG', rows: range(2, 21), level: 'platform', role: 'integrationoperator', scope: 'platform' },
]);

export const PROVIDERS: readonly ProviderDefinition[] = Object.freeze([
  { id: 'jdproduct', label: '京东', priority: 1, vendor: 'jd' },
  { id: 'jdfresh', label: '京东生鲜', priority: 1, vendor: 'jd' },
  { id: 'tmallmarket', label: '天猫超市', priority: 1, vendor: 'tmall' },
  { id: 'private', label: '自有供应商', priority: 1 },
  { id: 'cake', label: '蛋糕', priority: 1, vendor: 'cakeuncle' },
  { id: 'flower', label: '鲜花', priority: 1, vendor: 'cakeuncle' },
  { id: 'book', label: '图书', priority: 1, vendor: 'wenxuan' },
  { id: 'directcharge', label: '虚拟卡券/直充', priority: 1, vendor: 'wanlian' },
  { id: 'foodvoucher', label: '虚拟食品提货券', priority: 1, vendor: 'cakeuncle' },
  { id: 'movie', label: '电影', priority: 1, vendor: 'wanlian' },
  { id: 'meal', label: '在线点餐', priority: 1, vendor: 'cakeuncle' },
  { id: 'taobaonow', label: '淘宝闪购', priority: 3 },
  { id: 'elephantmarket', label: '小象超市', priority: 3 },
  { id: 'meituan', label: '美团', priority: 3 },
  { id: 'privatehome', label: '自营家政', priority: 3 },
  { id: 'jdhome', label: '京东家政', priority: 3 },
  { id: 'laundry', label: '干洗', priority: 4 },
  { id: 'errand', label: '配送跑腿', priority: 4 },
  { id: 'carservice', label: '车咖汽车服务', priority: 4 },
  { id: 'show', label: '大麦演出', priority: 4 },
]);

export const MVP_LABELS = Object.freeze([
  '平台层', '分销层', '集团数据大屏', '集团应用', '集团商品池', '集团订单', '集团卡券', '集团财务', '集团数据统计', '集团客服', '集团设置',
  '商城数据大屏', '商城装修', '商城商品池', '商城订单', '商城卡券', '商城财务', '商城数据统计', '商城客服', '商城设置', '优先级1接口',
] as const);

export const MVP_ROUTES = Object.freeze([
  '/platform', '/distributors', '/enterprises/current/dashboard', '/enterprises/current/applications', '/enterprises/current/products',
  '/enterprises/current/orders', '/enterprises/current/vouchers', '/enterprises/current/finance', '/enterprises/current/reports', '/enterprises/current/support',
  '/enterprises/current/settings', '/malls/current/dashboard', '/malls/current/design', '/malls/current/products', '/malls/current/orders', '/malls/current/vouchers',
  '/malls/current/finance', '/malls/current/reports', '/malls/current/support', '/malls/current/settings', '/channels',
] as const);

export const MVP_JOURNEYS = Object.freeze([
  'platform', 'distribution', 'groupdashboard', 'groupapplication', 'groupproduct', 'grouporder', 'groupvoucher', 'groupfinance', 'groupreport',
  'groupsupport', 'groupsetting', 'malldashboard', 'malldesign', 'mallproduct', 'mallorder', 'mallvoucher', 'mallfinance', 'mallreport', 'mallsupport', 'mallsetting', 'providers',
] as const);

export const MVP_RUNBOOKS = Object.freeze([
  'catalogsync', 'catalogsync', 'projection', 'experiencepublish', 'catalogsync', 'fulfillment', 'benefitgrant', 'reconciliation', 'export', 'supportsla',
  'riskscan', 'projection', 'experiencepublish', 'pricesync', 'paymentrefund', 'voucherexpiry', 'reconciliation', 'export', 'supportsla', 'riskscan', 'catalogsync',
] as const);
