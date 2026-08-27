# Main 來源與鎖定記錄

記錄日期：2026-08-27（Asia/Shanghai）

## 正式選用來源

| 目標                                                     | 來源                                                           | 選用原因                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `apps/storefront-web`                                    | `../archives/smart-wing/apps/storefront-web`                   | 使用者確認的消費 Web、Laptop 與 Desktop 1920 VI／UI／UE              |
| `apps/auth-web`                                          | `../archives/smart-wing/apps/auth-web`                         | 消費端登入抽屜的必要依賴，保留已確認的帳密、微信／企微流程           |
| `apps/console`                                           | `../archives/smart-wing-20260826/Shop/smart-wing/apps/console` | 使用者確認的 4173 新版後臺                                           |
| `services/commerce`、`packages/@shop`、核心 DB           | `../archives/smart-wing-20260826/Shop/smart-wing`              | 與指定 Console 的 217-operation 合同、SDK、權限及後續 Migration 相容 |
| `services/commerce-api`、`packages/@smart-wing`、相容 DB | `../archives/smart-wing`                                       | 指定 Storefront 目前直接依賴的 REST／RPC API 閉包                    |
| `docs/decisions/zhudatuan.md`、`每日問答.md`             | 築大團根目錄同名決策文件                                       | 保存本輪產品邊界、MVP 問答與後續交接記憶                             |

所有來源均按 2026-08-27 當時的工作樹實體檔案複製，包含已確認但尚未提交的 UI 改動；沒有從 Git HEAD 重新還原。

## 為何沒有直接使用 21 號 API 覆蓋新版 Console

21 號快照仍保存在：

`../archives/smart-wing-20260826/smart-wing`

它有較高的工作台靜態覆蓋。完整比對後已確認：其 206 個 Operations 是現行 217 個的嚴格子集，快照獨有的 Operation、Capability、Event、Migration 與後端 Service Source 均為 0。因 SDK 子路徑、Cockpit／Application 回應及後續權限 Migration 已演進，本輪不搬任何 21 號 API 原碼；只把工作台行為與測試需求作為歷史參考。

## 本輪只做的必要工程修正

- 補上消費端三個因舊 workspace hoisting 而漏寫的直接依賴。
- 修正 `apps/storefront-web/tsconfig.json` 多退一層的 include 路徑。
- 根命令改為指向已鎖定的 `@smart-wing/storefront-web` 和 `@smart-wing/auth-web`。
- 明確標注相容 REST Router 隨 Storefront Worker 同源構建；歷史 Admin AI Server 不作正式 API 制品。
- 舊版與新版 Migration 分目錄保存，禁止混跑。
- 建立 `config/artifacts.json`，鎖定三個 App、兩個 Service 與兩套隔離 Database。
- 修復 Repository Root、Workspace Lock、Local Infra 與 Migration Replay 門禁。
- 新增會員商城 Scope RLS 修復 Migration，以及兩套 API 的 Audience／Target 隔離。
- 鎖定 Linux x64 GNU／musl 原生構建依賴，並新增 Lock 門禁避免 macOS Lock 漏包回歸。
- 修復阿里雲 Commerce Docker 構建輸入與 Runtime 依賴閉包，加入秘密／本機產物隔離。

沒有修改兩套前端的頁面、元件、樣式、互動或視覺資產。

## 明確排除

- 所有來源 `.git`
- `node_modules`、`dist`、`.next`、`.wrangler`、coverage 與本機暫存
- `.env.local`、正式密鑰、TLS key／certificate、支付證書
- 其他未被本輪鎖定的前端 App

## 待完成閘門

1. 建立 Adapter/BFF，將消費端逐步切換到 Canonical Operation。
2. 在雲端預發布環境完成 Compatibility Database、Canonical RDS／Redis 與完整瀏覽器 E2E。
3. 通過後才將 `www`、`auth`、`console`、`api` 正式切換到本目錄制品。

## 搬入後驗證

- 合併後 `package-lock.json` 已重建，`npm ci` 通過。
- Storefront TypeScript 通過；48 個 test files、239 tests 通過；production build 通過。
- Console TypeScript 通過；14 個 test files、66 tests 通過；production build 通過。
- Auth TypeScript、3 tests 與 production build 通過。
- 核心 Commerce API TypeScript、34 個 test files／127 tests 與 bundle 通過。
- 消費端相容 API TypeScript、33 個 test files／179 tests 通過；完整 Router 隨 Storefront Worker 構建。
- 165 個 Migration Replay 與購物車／報價／訂單／支付／財務 MVP Kernel 通過。
- 根工作區 typecheck、unit tests 與單命令 build 全部通過。
- `npm audit --omit=dev`：0 個已知 production vulnerability。
- GitHub 提交 `3a5f3a3` 的 [Main Baseline Run 33095749724](https://github.com/Ethan7586/zhudatuan/actions/runs/33095749724) 通過 PostgreSQL／Redis、全部測試、三端構建、Commerce Alpine Image 與 Source Drift 驗證。

以 checksum dry-run 對照來源：Auth 的非生成檔完全一致；Console 只新增 `vitest.config.ts` 的自包含測試環境值；Storefront 只有 `package.json`、`tsconfig.json`、`vitest.config.ts` 三個必要工程檔不同。三套前端的頁面、元件、樣式、互動與視覺資產保持鎖定版本不變。

關鍵鎖定 SHA-256：

```text
007c24a955926c0e50b8702d81c74f80a5f028ca19397c95ac4251e87a6df37a  apps/storefront-web/src/components/laptop/StorefrontWebStandard.ts
d75d2df7135e50eaa8fd82b5025557feabd78a69969f45f4c48c407dd3c0372d  apps/storefront-web/src/showcase/Desktop1920Preview.tsx
f256673552219b7b118ea9cd9766b60fa3b67e6df9b606d8906ca64dc1febca1  apps/storefront-web/src/App.tsx
9e59f3b4abf5f8b359b42cd3c6e9c09dcda7decdaf36b1e0f19c5b427d27eac9  apps/console/src/main.tsx
35f59c78ab484bc7c498b9f990d5b0f84ad2e250a5502cd386f714735f6f59cc  apps/console/src/route/ProfessionalRouteCatalog.ts
18e988d19ddba5ab6d95d64ae96b39c375f499e21de26e044748a8830ec673c6  packages/contract/definitions/operations.yml
8b0a2a3811f8e82bfaae84488f31e19113082b847a9f32fb22ba9b8f746c67ef  docs/decisions/zhudatuan.md
bd4120cff919a7344f35f7677f792561d56740dbbf2f0b5a937fdde6b8367e07  docs/decisions/每日問答.md
581c6132e8b82a28914a591ee32a9a31c1113d2c3e85d29049efc744f915b03f  config/artifacts.json
8c5e8fd39acb950cf45d9017c1798d8e5e720f097919cf1aa20eaa13eb190750  database/supabase/migrations/20260821080000_restore_member_scope_authorization.sql
```
