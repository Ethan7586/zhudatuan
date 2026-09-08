// Generated from config/clients.yml and infrastructure/network/Edge.yml. Do not edit.
export const CLIENT_CATALOG_CHECKSUM = '63e080b64fb680c0183886c669fe2a58cad5c6fa8caa3190f2f3d2311fbdb50d' as const;
const CLIENT_SOURCE = [
  {
    "id": "auth",
    "title": "身份中心",
    "workspace": "@shop/auth",
    "path": "apps/auth",
    "sourceRoot": "src",
    "audience": "public",
    "domains": [
      "identity"
    ],
    "target": null,
    "transport": "browser",
    "route": "auth",
    "localPort": 3002,
    "origin": "https://passport.fufu.wang",
    "localOrigin": "http://127.0.0.1:3002"
  },
  {
    "id": "console",
    "title": "运营控制台",
    "workspace": "@shop/console",
    "path": "apps/console",
    "sourceRoot": "src",
    "audience": "console",
    "domains": [],
    "target": "console",
    "transport": "browser",
    "route": "console",
    "localPort": 4173,
    "origin": "https://console.fufu.wang",
    "localOrigin": "http://127.0.0.1:4173"
  },
  {
    "id": "storefront",
    "title": "消费者商城",
    "workspace": "@shop/storefront",
    "path": "apps/storefront",
    "sourceRoot": "src",
    "audience": "storefront",
    "domains": [],
    "target": "storefront",
    "transport": "browser",
    "route": "storefront",
    "localPort": 3000,
    "origin": "https://fufu.wang",
    "localOrigin": "http://127.0.0.1:3000"
  },
  {
    "id": "miniapp",
    "title": "微信小程序",
    "workspace": "@shop/miniapp",
    "path": "apps/miniapp",
    "sourceRoot": "miniprogram",
    "audience": "storefront",
    "domains": [],
    "target": "miniapp",
    "transport": "wechat",
    "route": "miniapp",
    "localPort": 4174,
    "origin": "https://miniapp.fufu.wang",
    "localOrigin": "http://127.0.0.1:4174"
  },
  {
    "id": "store",
    "title": "门店工作台",
    "workspace": "@shop/store",
    "path": "apps/store",
    "sourceRoot": "src",
    "audience": "console",
    "domains": [],
    "target": "store",
    "transport": "browser",
    "route": "store",
    "localPort": 4175,
    "origin": "https://store.fufu.wang",
    "localOrigin": "http://127.0.0.1:4175"
  },
  {
    "id": "supplier",
    "title": "供应链后台",
    "workspace": "@shop/supplier",
    "path": "apps/supplier",
    "sourceRoot": "src",
    "audience": "console",
    "domains": [],
    "target": "supplier",
    "transport": "browser",
    "route": "supplier",
    "localPort": 4176,
    "origin": "https://supplier.fufu.wang",
    "localOrigin": "http://127.0.0.1:4176"
  }
] as const;
export const CLIENT_CATALOG = Object.freeze(CLIENT_SOURCE.map((client) => Object.freeze({ ...client, domains: Object.freeze([...client.domains]) })));
export type ClientSurface = (typeof CLIENT_CATALOG)[number]['id'];
export type ClientTarget = Exclude<(typeof CLIENT_CATALOG)[number]['target'], null>;
export const CLIENT_BY_ID: ReadonlyMap<ClientSurface, (typeof CLIENT_CATALOG)[number]> = new Map(CLIENT_CATALOG.map((client) => [client.id, client]));
export const CLIENT_TARGETS = Object.freeze(CLIENT_CATALOG.flatMap((client) => client.target === null ? [] : [client.target])) as readonly ClientTarget[];
export const CLIENT_ORIGINS = Object.freeze(Object.fromEntries(CLIENT_CATALOG.map((client) => [client.id, client.origin]))) as Readonly<Record<ClientSurface, string>>;
export const CLIENT_LOCAL_ORIGINS = Object.freeze(Object.fromEntries(CLIENT_CATALOG.map((client) => [client.id, client.localOrigin]))) as Readonly<Record<ClientSurface, string>>;
