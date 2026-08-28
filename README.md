# 主打团正式主工程

`main/` 是主打团 zhudatuan 唯一的正式開發與部署根目錄。`../archives/` 只作歷史提詞庫與代碼找回庫，不直接構建或部署。

## 項目層級

- 消費 Web：`apps/storefront-web`，來自使用者確認的 27 吋／Laptop 標準版本。
- 營運後臺：`apps/console`，來自使用者確認的 4173 新版後臺。
- 統一登入：`apps/auth-web`，保留已批准的 3003 VI；Console 登入與員工自助註冊使用 Canonical Identity。

## API 邊界

目前保留兩條彼此隔離的 API 鏈路，這是為了讓兩套已確認前端先保持可運行，而不是宣稱合同已經統一：

1. 核心營運鏈路：`apps/console` → `services/commerce` → `database/supabase`。
2. Console 身份鏈路：`apps/auth-web` → `services/commerce` 的 Canonical Identity Operations；API Host-only Session Cookie、PKCE 與一次性 Ticket 不進 URL 或 Web Storage。
3. 消費端相容鏈路：`apps/storefront-web`／`apps/auth-web` 的註冊、找回與消費登入 → `services/commerce-api` → `database/storefront-compatibility/supabase`。

身份邊界：員工自助註冊經 Canonical 邀請、短信 Challenge 與版本化條款建立 `storefront` 身份；不會自動授予 Console 權限。現有消費 Web 的 Session Adapter 尚待接通，因此註冊成功不等同於商城自動登入。

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

Console 正式制品必须从干净工作区一次构建并通过最终 `dist` 浏览器验收；不得在生产机重新构建：

```bash
VITE_API_BASE_URL=https://api.zhudatuan.com \
VITE_AUTH_BASE_URL=https://accounts.zhudatuan.com \
VITE_CLIENT_VERSION=1.0.0 \
npm run release:console:build -- /absolute/output/console
```

该命令会拒绝缺失配置、脏工作区和提交号不一致的制品，并生成 `console-build.json`。上线后使用同一验收器核对生产实际提供的提交：

```bash
npm run release:console:verify -- \
  --url https://console.zhudatuan.com \
  --expected-commit "$(git rev-parse HEAD)" \
  --require-clean
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

## 阿里雲部署準備狀態

- 正式目標拓撲是 Cloudflare／阿里雲邊緣、OSS 靜態制品、ALB、ACK 中的 Commerce API／Jobs、RDS PostgreSQL、Redis 及 Secret Manager。
- Commerce 的 Alpine Docker 映像與本地／CI 構建基線已驗證；正式部署規範見 [`DEPLOYMENT.md`](./DEPLOYMENT.md) 與 [`infrastructure/aliyun/DEPLOY-阿里云.md`](./infrastructure/aliyun/DEPLOY-%E9%98%BF%E9%87%8C%E4%BA%91.md)。
- 當前 [`config/artifacts.json`](./config/artifacts.json) 中 Canonical 與 Compatibility 兩條制品鏈仍為 `releaseEligible=false`，所以現在是部署準備階段，不是正式切流狀態。
- 本輪只建設 `zhudatuan.com` 主平台及其已批准子域名。`hbbtzn.com` 不遷移、不下線、不修改 DNS，也不納入本輪部署與驗收，因此不構成築大團的發布阻斷。
- [`infrastructure/aliyun/delivery.yml`](./infrastructure/aliyun/delivery.yml) 中的 `hbbtzn.com`、Store、Supplier 與 Miniapp 條目只視為歷史參考，不作為本輪執行輸入。築大團部署必須另行按 `zhudatuan.com` 域名與 `config/artifacts.json` 的實際制品集合核定。
- 修改部署配置不等於獲准上線；完成預檢、版本固定、資料庫／Secret／回滾確認後，仍須 Owner 針對目標環境和版本下達正式部署批准。

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
