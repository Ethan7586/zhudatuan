# 築大團正式主工程

`main/` 是築大團唯一的正式開發與部署根目錄。`../archives/` 只作歷史提詞庫與代碼找回庫，不直接構建或部署。

## 已鎖定的兩套前端

- 消費 Web：`apps/storefront-web`，來自使用者確認的 27 吋／Laptop 標準版本。
- 營運後臺：`apps/console`，來自使用者確認的 4173 新版後臺。
- 統一登入：`apps/auth-web`，是消費 Web 的必要運行依賴。

## API 邊界

目前保留兩條彼此隔離的 API 鏈路，這是為了讓兩套已確認前端先保持可運行，而不是宣稱合同已經統一：

1. 核心營運鏈路：`apps/console` → `services/commerce` → `database/supabase`。
2. 消費端相容鏈路：`apps/storefront-web`／`apps/auth-web` → `services/commerce-api` → `database/storefront-compatibility/supabase`。

兩套合同不可共用同一組 Migration：新版使用 `@shop/*` Canonical Operation；消費端目前仍使用 `@smart-wing/*` REST/RPC 合同。正式合流需要新增 Adapter/BFF 並逐項驗證，不能直接覆蓋。

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
npm run build:commerce-api
```

## 建議域名

- `www.zhudatuan.com`：消費 Web
- `auth.zhudatuan.com`：統一登入
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
- Console、Storefront、Auth、核心 API、相容 API 的獨立 build
- 根目錄單命令 `npm run build`
- production dependencies audit：0 個已知漏洞

Vinext 的開發／構建依賴目前仍由 `image-size` 帶入 2 個 high severity DoS advisory；不進 production dependency 集，正式升級前需用完整回歸驗證取代，不能直接執行強制 major upgrade。
