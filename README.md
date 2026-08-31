# 築大團正式主工程

築大團是面向企業福利消費的多層級商城平台。`main/` 是築大團唯一的正式開發、測試、構建與部署根目錄；`../archives/` 只作歷史提詞庫與代碼找回庫，不直接構建或部署。

## 項目層級

```text
zhudatuan（主項目與唯一正式代碼平台）
└── projects/hbbtzn（獨立部署／租戶子項目）
```

[`projects/hbbtzn`](./projects/hbbtzn/README.md) 共享築大團已批准制品，但不複製前後端、不加入 npm Workspace，也不改動 `config/artifacts.json`。其域名、資料、密鑰、發布和回滾必須獨立；當前保持現狀，不納入 `zhudatuan.com` 主站部署。

## Owner 變更批准制度

`main/` 採 Owner（Ethan）批准制。

- **受控範圍**：任何新增、刪除、重命名、移動、替換或實質修改功能、服務、頁面與交互、VI／UI／UE 與設計資產、API／合同、資料模型與 Migration、依賴、腳本、測試基線、構建、CI/CD、容器、DNS、雲資源及其他基礎設施，開始實施前均須取得 Owner 明確批准。
- **什麼算批准**：Owner 直接下達、且動作與目標範圍清楚的實施指令，例如「把 X 加入 `main`」「刪除 Y」「修改 Z 並部署到測試環境」。該指令只批准完成其明確目標所必需、可合理預見的變更。
- **什麼不算批准**：提問、討論、構想、建議、比較、評分、審查、只讀盤點、模擬圖／原型展示，以及「研究一下」「先看看」「你覺得如何」均不構成修改授權。
- **不得擴張**：批准一次、範圍一次有效；不得據此增加相鄰功能、順手重構、刪除歷史資產或改動未點名的服務。若實施中發現需要超出原範圍，須停止並再次取得批准。
- **唯讀例外**：不改變檔案、Git、資料、雲資源或外部狀態的檢查、測試、審計與方案整理可以直接進行。
- **生產部署另行批准**：代碼修改批准不等於生產發布批准。每次對阿里雲、Cloudflare、正式 DNS、正式資料庫或正式域名的部署、切流、Migration、回滾與資源變更，均須再次取得針對環境、目標版本和操作範圍的明確批准。測試／預覽部署也只有在原指令明確包含部署時才獲授權。
- **記錄要求**：所有獲批變更須在提交、PR 或相應操作日誌中記錄 Owner 指令、變更範圍、驗證結果與回退方式；刪除或不可逆操作另須在執行前再次核對精確目標。

## 已鎖定的正式前端與後臺

| 制品                  | 技術棧                                                                                             | 正式用途                                             |
| --------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/storefront-web` | Next.js 16 App Router／Vinext、React 19、TypeScript、Tailwind CSS 4、Motion                        | 消費者購物 Web；使用者已確認的 27 吋／Laptop 標準 VI |
| `apps/console`        | React 19、Vite 8、TypeScript、React Router、TanStack Query／Table、React Aria、Zod、Tailwind CSS 4 | 企業營運後臺；使用者已確認的 4173 新版後臺           |
| `apps/auth-web`       | React 19、Vite 8、TypeScript、Tailwind CSS 4                                                       | 統一身份中心；Console 已接 Canonical Session，消費端身份仍在相容軌道 |

目前正式 `main/` 沒有 `apps/miniapp`；小程序歷史代碼不等於正式制品，只有經 Owner 選定、移植與驗收後才能加入。

三套前端的唯一入口、域名、批准狀態與 SHA-256 由 [`config/owner-approved-ui.json`](./config/owner-approved-ui.json) 鎖定。部署不得從 `archives/` 取檔，也不得自行改選其他 `App.tsx`、預覽路由或歷史制品。

## 已鎖定的 API、資料與運行底座

| 層級                 | 正式路徑／技術                                  | 責任                                                            |
| -------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Canonical API        | `services/commerce`；Node.js 22、TypeScript     | 217 個 Canonical Operations、ApiMain、JobsMain 與核心業務規則   |
| Canonical 合同       | `packages/contract`、`packages/sdk`             | 版本化 Schema、生成 SDK、Scope、冪等、併發版本及 Step-up 上下文 |
| Canonical 資料庫     | `database/supabase`；PostgreSQL／RLS            | 正式 Schema、165 個 Migration、Scope 隔離與業務資料真值         |
| Cache／Jobs          | Redis、JobsMain                                 | 快取、租約、異步任務與 Outbox 消費                              |
| Compatibility BFF    | `services/commerce-api`；TypeScript REST Router | Storefront／Auth 遷移期接口，不是最終 Canonical API             |
| Compatibility 資料庫 | `database/storefront-compatibility/supabase`    | 與 Canonical 資料庫隔離的過渡期資料模型                         |

正式調用關係：

```text
企業營運後臺 → Canonical SDK／Contract → Commerce API → PostgreSQL／Redis
統一身份中心（Console 登錄）→ PKCE／一次性 Ticket → Commerce Identity API
消費 Web／統一身份中心（消費註冊與找回）→ Compatibility REST BFF → Compatibility PostgreSQL
```

## API 邊界

目前保留兩條彼此隔離的 API 鏈路，這是為了讓兩套已確認前端先保持可運行，而不是宣稱合同已經統一：

1. 核心營運鏈路：`apps/console` → `services/commerce` → `database/supabase`。
2. Console 身份鏈路：`apps/auth-web` → `services/commerce` 的 Canonical Identity Operations；API Host-only Session Cookie、PKCE 與一次性 Ticket 不進 URL 或 Web Storage。
3. 消費端相容鏈路：`apps/storefront-web`／`apps/auth-web` 的註冊、找回與消費登入 → `services/commerce-api` → `database/storefront-compatibility/supabase`。

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

`services/commerce-api` 的完整 REST Router 目前由 `apps/storefront-web` Worker 同源嵌入，會隨 Storefront 一起構建；歷史 `adminServer.ts` 只包含 Health／AI 接口，不是完整相容 API 制品。

## 正式域名規劃

- `zhudatuan.com`：消費者購物 Web；`www.zhudatuan.com` 永久跳轉至此
- `console.zhudatuan.com`：企業營運後臺
- `accounts.zhudatuan.com`：統一身份中心
- `api.zhudatuan.com`：平台 API
- `media.zhudatuan.com`：商品圖片、影片與其他媒體資產的 CDN 入口
- `labs.zhudatuan.com`：設計、測試與內部預覽；不得承載正式交易
- `chat.zhudatuan.com`：在線客服、客服會話與問題工單入口

`chat.zhudatuan.com` 不承擔「Bug 修復」本身。使用者回報的問題可以由客服轉成工單，但定位、修復、測試和發布仍屬內部研發流程。

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
- Console、Storefront、Auth、核心 API、相容 API 的獨立 build
- 根目錄單命令 `npm run build`
- production dependencies audit：0 個已知漏洞

Vinext 的開發／構建依賴目前仍由 `image-size` 帶入 2 個 high severity DoS advisory；不進 production dependency 集，正式升級前需用完整回歸驗證取代，不能直接執行強制 major upgrade。
