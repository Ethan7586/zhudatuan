import { defineProviderCatalog } from '@shop/providercore';

export const MovieCatalog = defineProviderCatalog({
  id: 'movie',
  name: '电影',
  business: '电影选座出票',
  clients: ['console', 'storefront', 'miniapp', 'supplier'],
  settings: ['连接认证', '城市与影院', '影片场次', '锁座出票', '退款与对账'],
  help: '管理影院、影片、场次、座位、锁座、出票和退款。',
});
