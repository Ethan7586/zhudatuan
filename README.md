# 築大團正式主工程

`main/` 是築大團唯一的正式開發與部署根目錄。`../archives/` 只作歷史提詞庫與代碼找回庫，不直接構建或部署。

## 已鎖定的兩套前端

- 消費 Web：`apps/storefront-web`，來自使用者確認的 27 吋／Laptop 標準版本。
- 營運後臺：`apps/console`，來自使用者確認的 4173 新版後臺。
- 統一登入：`apps/auth-web`，保留已批准的 3003 VI；Console 登入與員工自助註冊使用 Canonical Identity。

## API 邊界

目前保留兩條彼此隔離的 API 鏈路，這是為了讓兩套已確認前端先保持可運行，而不是宣稱合同已經統一：

1. 核心營運鏈路：`apps/console` → `services/commerce` → `database/supabase`。
2. 消費端相容鏈路：`apps/storefront-web`／`apps/auth-web` → `services/commerce-api` → `database/storefront-compatibility/supabase`。

身份邊界：員工自助註冊經 Canonical 邀請、短信 Challenge 與版本化條款建立 `storefront` 身份；不會自動授予 Console 權限。現有消費 Web 的 Session Adapter 尚待接通，因此註冊成功不等同於商城自動登入。

兩套合同不可共用同一組 Migration：新版使用 `@shop/*` Canonical Operation；消費端目前仍使用 `@smart-wing/*` REST/RPC 合同。正式合流需要新增 Adapter/BFF 並逐項驗證，不能直接覆蓋。

8 月 21 日的 206 個 Canonical Operations 已核實為目前 217 個 Operations 的嚴格子集，無 API 原碼需要搬回。詳細矩陣、權限修復與未完成證據見 [`docs/operations/2026-08-27-api-recovery-log.md`](./docs/operations/2026-08-27-api-recovery-log.md)。正式制品集合由 [`config/artifacts.json`](./config/artifacts.json) 鎖定；在真資料庫與外部 Provider 驗收前，兩條軌道均保持 `releaseEligible=false`。

## 本地命令

```bash
cp apps/console/.env.example apps/console/.env.local
npm ci
npm run dev:console
npm run dev:storefront
npm run dev:auth
```

構建：

```bash
npm run build:console
npm run build:storefront
npm run build:auth
npm run build:commerce
```

`services/commerce-api` 的完整 REST Router 目前由 `apps/storefront-web` Worker 同源嵌入，會隨 Storefront 一起構建；歷史 `adminServer.ts` 只包含 Health／AI 接口，不是完整相容 API 制品。

## 正式域名

- `zhudatuan.com`：消費者購物 Web
- `www.zhudatuan.com`：永久跳轉到 `zhudatuan.com`
- `accounts.zhudatuan.com`：統一身份中心
- `console.zhudatuan.com`：營運後臺
- `api.zhudatuan.com`：核心營運 API
- `chat.zhudatuan.com`：客服系統

目前的消費端相容 API 應與消費 Web 同源部署，或使用獨立的內部相容域名；在合同統一前不要直接掛到核心 `/api/v1`。

## 安全規則

- 只提交 `.env.example`，正式密鑰由阿里雲／Cloudflare Secret 注入。
- 不提交 `node_modules`、`dist`、`.next`、`.wrangler`、TLS 私鑰或支付證書。
- `database/supabase` 與 `database/storefront-compatibility/supabase` 必須部署到隔離的測試資料庫。
- 來源、選擇理由與已知差異見 `SOURCE-MANIFEST.md`。

## 已驗證基線

2026-08-27 已在 Node `22.22.3` 完成：

- `npm ci`
- 根工作區 typecheck
- 根工作區 unit tests
- Console、Storefront、Auth 與核心 API 的獨立 build；相容 REST Router 隨 Storefront Worker 構建
- 根目錄單命令 `npm run build`
- 165 個 Migration Replay 與購物車／報價／訂單／支付／財務 MVP Kernel
- Canonical 與 Compatibility 的 Audience／Target 身份隔離測試
- production dependencies audit：0 個已知漏洞

Vinext 的開發／構建依賴目前仍由 `image-size` 帶入 2 個 high severity DoS advisory；不進 production dependency 集，正式升級前需用完整回歸驗證取代，不能直接執行強制 major upgrade。
