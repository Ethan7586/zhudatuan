# Main 來源與鎖定記錄

記錄日期：2026-08-28（Asia/Shanghai）

## 正式選用來源

| 目標                                                     | 來源                                                           | 選用原因                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `01_core_hexin/apps/storefront-web`                                    | `../archives/smart-wing/apps/storefront-web`                   | 使用者確認的消費 Web、Laptop 與 Desktop 1920 VI／UI／UE                                   |
| `01_core_hexin/apps/auth-web`                                          | `../archives/smart-wing-20260826/Shop1/apps/auth-web`          | 使用者確認的 3003 登入 VI 母版；正式行為保留 zhudatuan 域、真實 Cookie 登入與安全關閉策略 |
| `01_core_hexin/apps/console`                                           | `../archives/smart-wing-20260826/Shop/smart-wing/apps/console` | 使用者確認的 4173 新版後臺                                                                |
| `01_core_hexin/services/commerce`、`01_core_hexin/packages/@shop`、核心 DB           | `../archives/smart-wing-20260826/Shop/smart-wing`              | 與指定 Console 的 217-operation 合同、SDK、權限及後續 Migration 相容                      |
| `01_core_hexin/services/commerce-api`、`01_core_hexin/packages/@smart-wing`、相容 DB | `../archives/smart-wing`                                       | 指定 Storefront 目前直接依賴的 REST／RPC API 閉包                                         |
| `05_docs_ziliao/docs_wendang/decisions/zhudatuan.md`、`每日問答.md`             | 築大團根目錄同名決策文件                                       | 保存本輪產品邊界、MVP 問答與後續交接記憶                                                  |

初始來源按 2026-08-27 當時的工作樹實體檔案收攏，包含已確認但尚未提交的 UI 改動；沒有從 Git HEAD 重新還原。2026-08-28 又完成一次 Owner 指定的正式入口修正，結果由 [`02_platform_pingtai/config/owner-approved-ui.json`](./02_platform_pingtai/config/owner-approved-ui.json) 鎖定。

## 2026-08-28 Owner 批准的三套正式入口

| 域名                     | 唯一正式入口                                                                         | 批准標準                                   | 當前驗收邊界                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `zhudatuan.com`          | `01_core_hexin/apps/storefront-web/app/page.tsx` → `src/StorefrontRoot.tsx` → `StorefrontWebFrame` | 原 `/laptop-web` 的 27 吋／Laptop 組件標準 | VI、型別、51 個 test files／278 tests、production build 已通過；正式資料仍受 Compatibility API 狀態限制     |
| `accounts.zhudatuan.com` | `01_core_hexin/apps/auth-web/src/App.tsx` → `src/screens/LoginPage.tsx`                            | 3003 三段式登入、企微藍／微信綠            | 密碼登入以頂層 POST 在目標域建立真實 Cookie；OTP、QR、SSO、多身份選擇、Step-Up 在正式服務接通前 fail-closed |
| `console.zhudatuan.com`  | `01_core_hexin/apps/console/src/main.tsx` → `ConsoleRouter.tsx`                                    | 4173 `admin-web-v1`                        | 非財務 150/150 檔與批准快照一致；本地演示仍使用 4311 Fixture，不等於正式 API 驗收                           |

以下入口明確不得再被構建或部署：

- 已刪除的 `01_core_hexin/apps/storefront-web/src/App.tsx` 在內共 38 個錯版檔案。
- 已刪除的 Auth `AdminDashboardScreen`、`AuthCallbackScreen`、`StorefrontHomeScreen` 三個 hbbtzn／Mock 舊頁。
- `archives/` 中的任何檔案；它只作找回證據，不是制品來源。
- `02_platform_pingtai/infrastructure/aliyun/delivery.yml`、`02_platform_pingtai/infrastructure/storefront-compatibility/aliyun/` 與 `04_tools/scripts/release/candidate.mjs` 不得用於築大團候選制品；其路由或入口仍屬舊項目。

築大團部署只能讀取 `02_platform_pingtai/infrastructure/zhudatuan/aliyun/`。Console 的 `/design-references/*` 與 `/demo/*` 在正式後臺域返回 404，只能由 `labs.zhudatuan.com` 讀取；這保留 Owner 指定的三套原始設計參考，同時不把它們當正式後臺頁面。

## 為何沒有直接使用 21 號 API 覆蓋新版 Console

21 號快照仍保存在：

`../archives/smart-wing-20260826/smart-wing`

它有較高的工作台靜態覆蓋。完整比對後已確認：其 206 個 Operations 是現行 217 個的嚴格子集，快照獨有的 Operation、Capability、Event、Migration 與後端 Service Source 均為 0。因 SDK 子路徑、Cockpit／Application 回應及後續權限 Migration 已演進，本輪不搬任何 21 號 API 原碼；只把工作台行為與測試需求作為歷史參考。

## 2026-08-27 的必要工程修正

- 補上消費端三個因舊 workspace hoisting 而漏寫的直接依賴。
- 修正 `01_core_hexin/apps/storefront-web/tsconfig.json` 多退一層的 include 路徑。
- 根命令改為指向已鎖定的 `@smart-wing/storefront-web` 和 `@smart-wing/auth-web`。
- 明確標注相容 REST Router 隨 Storefront Worker 同源構建；歷史 Admin AI Server 不作正式 API 制品。
- 舊版與新版 Migration 分目錄保存，禁止混跑。
- 建立 `02_platform_pingtai/config/artifacts.json`，鎖定三個 App、兩個 Service 與兩套隔離 Database。
- 修復 Repository Root、Workspace Lock、Local Infra 與 Migration Replay 門禁。
- 新增會員商城 Scope RLS 修復 Migration，以及兩套 API 的 Audience／Target 隔離。
- 鎖定 Linux x64 GNU／musl 原生構建依賴，並新增 Lock 門禁避免 macOS Lock 漏包回歸。
- 修復阿里雲 Commerce Docker 構建輸入與 Runtime 依賴閉包，加入秘密／本機產物隔離。

這一節只描述 2026-08-27 初始收攏；2026-08-28 的正式入口修正以上一節與 Owner 批准清單為準。

## 明確排除

- 所有來源 `.git`
- `node_modules`、`dist`、`.next`、`.wrangler`、coverage 與本機暫存
- `.env.local`、正式密鑰、TLS key／certificate、支付證書
- 其他未被本輪鎖定的前端 App

## 待完成閘門

1. 部署 Compatibility Runtime 前，先套用 `20260828060000_auth_membership_selection_boundary.sql`，並以真資料庫驗證雙 Membership 帳號回 409 且不簽發 Cookie。
2. 部署相容商城媒體寫回前，套用 `02_platform_pingtai/database/storefront-compatibility/supabase/migrations/20260828061000_catalog_media_domain_boundary.sql`，並先確認對象已存在於 `media.zhudatuan.com`；Migration 不會擅自改寫舊資料 URL。Canonical 資料庫的對應變更須由其後端工作流另行審批，不能混入本次 UI 基線。
3. 建立明確的 Auth Adapter，統一 Compatibility 的 `storefront|admin` Session 與 Canonical 的 `console` Session。現在消費 Web 的登入閉環可驗證，但 Console 的 Canonical `target=console` 真登入尚未閉合，不能宣稱三端正式登入完成。
4. 將消費端商品、購物車、訂單、支付與 Session 逐步切換到 Canonical Operation，或由 Owner 明確批准 Compatibility 軌道的暫時上線範圍。
5. 候選切流前必須由官方 Caddy 執行 `fmt`、`adapt --validate` 與 `validate`，並確認 3000／3001 不暴露於公網安全組；`API_ALLOWED_ORIGINS` 必須包含 `https://console.zhudatuan.com`。
6. 在雲端預發布環境完成 Compatibility Database、Canonical RDS／Redis 與完整瀏覽器 E2E。僅展示 UI 時必須標記為 `visual preview`；不得把 HTTP 200、TLS 或 Fixture 綠燈寫成前後端正式通過。

## 搬入後驗證

- 合併後 `package-lock.json` 已重建，`npm ci` 通過。
- Storefront TypeScript 通過；51 個 test files、278 tests 通過；production build 通過；正式根入口使用同一批准組件家族，Desktop 1920 與 Laptop 切換不再是假按鈕，微信／Android／Tablet 只在 labs 開放。
- Console TypeScript 通過；16 個 test files、82 tests 通過；production build 通過；非財務批准區 150/150 檔與快照一致。
- Auth TypeScript、10 tests 與 production build 通過；production bundle 不含 hbbtzn、假 PAT/Ticket、固定 Step-Up 驗證碼、除錯碼或測試帳號。獨立 accounts 頁透過白名單頂層 POST，由 `zhudatuan.com`／`console.zhudatuan.com` 建立各自的 Host-only Cookie。
- Compatibility BFF 已補齊 Storefront 的安全本地回跳：只接受同源相對路徑，Cookie 建立後回到商城，不將帳密或票據放進 URL；登入、初始改密與登出均有 Origin／CSRF 邊界。
- 核心 Commerce API TypeScript、34 個 test files／127 tests 與 bundle 通過。
- 消費端相容 API TypeScript、33 個 test files／196 tests 通過；完整 Router 隨 Storefront Worker 構建；舊域／未知 Host、labs 交易 API、缺失 Membership 選擇合同均 fail-closed。
- 165 個 Migration Replay 與購物車／報價／訂單／支付／財務 MVP Kernel 通過。
- Owner 門禁已驗證 3 個正式表面、38 個鎖定檔案；正式 Caddy、delivery、process topology 與必要 Migration 均納入 SHA-256 真值。
- `npm audit --omit=dev`：0 個已知 production vulnerability。
- GitHub 提交 `3a5f3a3` 的 [Main Baseline Run 33095749724](https://github.com/Ethan7586/zhudatuan/actions/runs/33095749724) 是上一輪搬運基線，不包含本次 Owner 入口修正；新本地提交與 CI 尚未產生前，不能拿它替代本次證據。

2026-08-27 的 checksum dry-run 只證明當時搬運完整，不再代表目前批准入口。現在必須以 `02_platform_pingtai/config/owner-approved-ui.json` 的入口與 SHA 為準；任何部署任務不得再透過「目錄中哪個 App 看起來像正式入口」自行推斷。

完整 SHA-256 不在本文重複維護；唯一機器可讀真值是 [`02_platform_pingtai/config/owner-approved-ui.json`](./02_platform_pingtai/config/owner-approved-ui.json)。當前清單鎖定 38 個檔案，`04_tools/scripts/check/owner-approved-ui.mjs` 會同時檢查入口、拒絕入口、正式域名、Caddy、delivery、process topology 與 Migration 是否漂移。
