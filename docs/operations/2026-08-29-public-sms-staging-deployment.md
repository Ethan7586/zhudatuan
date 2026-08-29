# 主打團公網短信預發布部署記錄

日期：2026-08-29（Asia/Shanghai）

## Owner 授權

Owner 明確批准：修改預發布部署配置、補上 JobsMain，將當前 `main` 部署到隔離公網測試環境，接通測試 RDS、Redis、Secret Store、KMS 與阿里雲短信；不切正式流量、不修改正式資料。

## 結論

本輪完成了乾淨 Release 基線、隔離身份／短信部署配置及前端 staging Origin 邊界，但**沒有執行新的公網切換或資料 Migration**。原因是實際雲端尚不存在獨立 staging RDS、Redis、Secret Catalog、KMS 邊界及三個 staging Host；在這些依賴缺失時啟動完整 `JobsMain` 會失敗關閉。

不得將本輪標記為「完整 JobsMain＋RDS／Redis 預發布已部署」。

## Release 基線

- 乾淨基線：`origin/main` `13781f10e8f98e9d1ecf8d543c88398c1de5c108`。
- 本機原工作樹 HEAD `01f1ed4` 落後遠端 15 個提交且含 303 個未提交項，未作部署輸入。
- 本輪使用獨立分支 `codex/staging-sms-20260829`，沒有覆蓋或清理原工作樹。

## 已完成準備

- 新增隔離 staging Caddy、PM2、delivery、API env 與 identity-notification worker env 配置。
- API 與 Worker 使用不同 env、Bearer Token、資料庫角色、Release／shared／log 路徑。
- Auth 新增 build-time 精確 HTTPS Origin allowlist；production 預設仍只接受 canonical origins。
- 已通過 Auth 38 個測試、TypeScript、staging production build、Console build、Commerce bundle、registration deployment check、171 個 Migration inventory check、Owner／seed 38 個測試及身份／短信 31 個聚焦測試。

隔離配置刻意使用 `IdentityRegistrationApiMain.js` 與 `IdentityNotificationJobsOnlyMain.js`，因此只足以承載註冊與短信驗收；它不是完整 `JobsMain`，也沒有把缺失的 Redis／支付／微信／Provider Secret 偽裝為已接通。

## 現有公網只讀證據

對現有 ECS `123.57.232.253` 的只讀核對結果：

- `accounts.zhudatuan.com`、`console.zhudatuan.com`、`api.zhudatuan.com/health/ready` 均為 HTTPS 200，TLS 驗證結果為 0。
- 現行 Release 與 GitHub `origin/main` 同為 `13781f1`。
- `zhudatuan-api.service`、`zhudatuan-identity-notification-jobs.service`、Secret Store、KMS 與隔離 PostgreSQL 均為 active／healthy。
- 短信配置存在，使用 ECS RAM Role；Secret 值未輸出。
- `identity.challengedelivery` 有 2 筆 `sent`，時間分別為 `2026-08-28 21:32:36Z` 與 `2026-08-28 21:58:05Z`；對應 job 均為 `completed`。這只證明阿里雲同步接受並回傳 BizId，不等於運營商最終送達證明。
- 現有可用 storefront 測試邀請已達 `2/2` 使用上限；公網 Identity API 未開放 `identity.invitations.create`，所以目前不能從 Owner 後臺建立新的公網邀請。

## 阻斷項

1. 尚無獨立測試 RDS／角色／snapshot／PITR 證據；現有註冊庫是 ECS 本機 Docker PostgreSQL。
2. 尚無獨立 staging Redis ref；現有 Redis 不得直接復用。
3. 現有 Secret Store／KMS 沒有 staging namespace／workload tokens／refs。
4. 完整 `JobsMain` 還需要 Extension、微信、支付、發票、打款、通知與 Object Store 全套 refs；缺一即啟動失敗。
5. 尚無可用的 staging DNS／TLS／Cloudflare Access 三域。
6. 本機無阿里雲資源管理憑據、ACK context、Cloudflare DNS token；ECS RAM Role 僅能確認短信運行配置，無 RDS／Redis 建立權限證據。
7. `config/artifacts.json` 仍為 `releaseEligible=false`；本輪 Auth 檔案變更也尚未形成獨立 staging Hash 真值。

## 下一個可執行步驟

取得限定 `zhudatuan-staging` 的阿里雲／Cloudflare 管理權限，或由 Owner 先建立下列資源並只提供 Secret Reference：

- staging RDS PostgreSQL 與 API／Jobs／Migration 專用角色；
- staging Redis；
- staging Secret Store／KMS namespace 與分離 workload token；
- `accounts-staging`、`console-staging`、`api-staging` 三個 Host 及 Access policy；
- 完整 Jobs Secret refs，或明確批准先以 identity-only worker 完成短信驗收。

資源齊備後才可執行 Migration、Owner seed、邀請、真手機短信與 Console 登入 E2E。

## 回退

本輪未修改 ECS、Cloudflare、阿里雲資源、資料庫或正式流量，因此不需要雲端回退。刪除本地 staging 分支／worktree 即可撤回本輪準備；不得刪除現有 ECS Release 或資料卷。
