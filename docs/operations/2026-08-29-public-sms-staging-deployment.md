# 主打團公網短信預發布部署記錄

日期：2026-08-29（Asia/Shanghai）

## Owner 授權

Owner 明確批准：修改預發布部署配置、補上 JobsMain，將當前 `main` 部署到隔離公網測試環境，接通測試 RDS、Redis、Secret Store、KMS 與阿里雲短信；不切正式流量、不修改正式資料。

## 結論

本輪完成了乾淨 Release 基線、`identity-sms`／`full` 兩套顯式隔離配置及前端 staging Origin 邊界，並把一份 **inactive 候選包**上傳到 ECS；**沒有建立 `current`、安裝服務、開放 listener、執行 Migration、切換公網流量或修改正式資料**。`full` 已配置為由 `JobsMain.js` 進入 bundle 內最新 `FullJobsMain.ts`，同時保持 `deployable: false`；獨立 staging RDS、Redis、Secret Catalog、KMS、Object Store 及完整 Provider 配置缺一即失敗關閉。

不得將本輪標記為「完整 JobsMain＋RDS／Redis 預發布已部署」。

## Release 基線

- 乾淨基線：`origin/main` `13781f10e8f98e9d1ecf8d543c88398c1de5c108`。
- 本機原工作樹 HEAD `01f1ed4` 落後遠端 15 個提交且含 303 個未提交項，未作部署輸入。
- 本輪使用獨立分支 `codex/staging-sms-20260829`，沒有覆蓋或清理原工作樹。

## Inactive 候選包

- 候選提交：`048b6ca5875e2883d3066acd6c28fce381d61745`。
- 遠端目錄：`/opt/zhudatuan-staging-full/releases/048b6ca5875e2883d3066acd6c28fce381d61745`。
- 遠端封存：`/opt/zhudatuan-staging-full/releases/048b6ca5875e2883d3066acd6c28fce381d61745.tar.gz`。
- SHA-256：`20c695cc387929823dd1bee8ae237033f033d08ea5901945e7991f016443dea4`；共 313 個 tar 條目，2,456,220 bytes。
- 白名單含 Auth／Console build、指定 Commerce entrypoints、migrations 與 full staging 配置；已確認不含 `.env`、`node_modules`、`LocalObjectsMain.js`、正式 Owner bootstrap 或 `BootstrapRegistration.js`。
- 遠端校驗後 `/opt/zhudatuan-staging-full/current` 仍不存在，staging unit 為 `not-found`，4431／55442／8643／8644 均無 listener。
- 正式 `/opt/zhudatuan/current` 仍指向 `13781f10e8f98e9d1ecf8d543c88398c1de5c108-login-acl-20260829`，`zhudatuan-api.service` 仍為 active。

## 已完成準備

- 新增顯式命名的 `identity-sms` 與 `full` Caddy／PM2／delivery 配置；沒有可誤啟兩套的默認 profile。
- `full` 使用不同的 Release／shared／log path、API port 4431、獨立 Redis ref、完整 Jobs Secret refs，以及 Migration／boundary reconciliation／`BootstrapStagingOwner` 制品清單。
- API、Jobs 與一次性程式使用不同 env 和資料庫角色；受現有 Local Secret／KMS runtime 的單 Bearer 合同限制，它們共用一個 full-staging Secret Store Bearer 及一個 full-staging KMS Bearer，兩種 Bearer 必須互異，且整套 runtime 不得復用正式驗收的 catalog、master key、token 或 8543／8544 listener。
- `InternalRuntimeMain.js` 由獨立 systemd service 在 8643／8644 提供 Secret Store／KMS；`registration-only` profile 名只代表其 bundle 範圍，不提供 Object Store。完整 Object Store 仍是 external provider blocker。
- Staging Owner bootstrap 使用獨立高熵 receipt 做重跑一致性校驗；receipt、Owner password、identity key 三個 Secret reference 強制互異，資料庫不再持久化可枚舉的密碼指紋。
- Auth 新增 build-time 精確 HTTPS Origin allowlist；production 預設仍只接受 canonical origins。
- Owner 可在 Console 建立固定單次、綁定手機、七天有效的普通管理員邀請；受邀者註冊後會在同一交易建立 storefront 與 operator membership，operator 初始角色為零業務權限。邀請碼只在前端記憶體短暫存在，成功、編輯、關閉或卸載即清除。
- 公網資料庫邊界新增固定 registration membership／role／scope 寫入約束、邀請不可變欄位與 Owner 持續保護；歷史上非 Owner 的 `identity.invitation.manage` grant 已清除，registration-only handler 另有 canonical Owner 校驗。
- 權限解析只投影 active role／permission；角色 scope 必須覆蓋 membership 與 grant，`role:self` 僅限 self／Owner，direct override 與 scope grant 正交、deny 優先，grant epoch 必須滿足 `0 < epoch <= membership.access_version`。Scope deny 目前明確不受支持，應用層與資料庫均 fail-closed 拒絕，不偽稱已有 deny 繼承語義。
- Staging Owner bootstrap 現在同時校驗 registration baseline 與本輪 `20260829060000` migration 的精確 checksum；Internal Runtime unit 亦在啟動前檢查 CA、server certificate 與 private key 均存在。
- 已通過 Auth 44 個、Console 全套 72 個（封版後會員邀請聚焦 4 個亦通過）、Commerce 247 個、Contract 12 個及 Owner／seed 42 個測試；相關 TypeScript、sslip.io staging production builds、Commerce bundle、registration deployment check、172 migration fresh/full replay、inventory 與 staging fail-closed env checks 均通過。封版時再次並行跑 Console 全套曾有 5 秒資源逾時與一項無關應用列表斷言，未改測試 timeout；受影響的本次會員邀請檔以單 worker 重跑 4/4 通過。
- 兩輪獨立只讀安全審計均未發現邀請、Owner、權限 resolver 或資料庫 trigger 的 P0／P1／P2；部署審計結論是允許生成／上傳 inactive 候選包，但在外部資源未驗證前禁止切換 `current`、安裝 unit、啟動 PM2/systemd 或 reload Caddy。
- ECS 上以臨時 `sslip.io` Host 執行的 `caddy validate` 回 `Valid configuration`；Internal Runtime unit 的 `systemd-analyze verify` 亦通過。兩項都只驗證候選配置，未 reload Caddy、未安裝 unit、未啟動服務。

`identity-sms` 刻意使用 `IdentityRegistrationApiMain.js` 與 `IdentityNotificationJobsOnlyMain.js`；`full` 則使用同一最小公網身份 API 與 `JobsMain.js`／`FullJobsMain.ts`。兩者的 Caddy 均只精確放行身份路由，新增 `POST /api/v1/identity/invitations` 與單一 ID segment 的 DELETE，應用內 authenticated operator policy 保持不變。配置沒有把缺失的 Redis／支付／微信／Provider Secret 偽裝為已接通。

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
3. Dedicated Internal Runtime 的 systemd／env／artifact 合同已補齊，但 staging catalog、TLS、KMS master key 及兩個不同 Bearer 尚未 provision；正式驗收的 8543／8544 明確禁止復用。
4. 完整 `JobsMain` 還需要 Extension、微信、支付、發票、打款、通知與 Object Store 全套 refs；缺一即啟動失敗。
5. 品牌 staging DNS 仍為 NXDOMAIN。三個 `*.staging.123-57-232-253.sslip.io` 臨時 Host 已確認解析到 ECS，可避免修改 DNS，但 Caddy ACME／HTTPS 尚未實測，且不能稱為品牌 staging DNS。
6. 本機無阿里雲資源管理憑據；ECS RAM Role `zhudatuan-identity-notification` 的 STS 身份可讀，但 RDS `DescribeDBInstances` 回 `Forbidden`、Tair `DescribeInstances` 回 `Forbidden.RAM`，因此更不具備建立隔離 RDS／Tair 的權限。不得擴權此短信 runtime role，應另用短時 staging provisioner。
7. 正式發布 gate 未被偽造：`check:approved-ui` 因本輪 Auth 變更與正式鎖定 hash 不同而拒絕，`check:deployment` 仍因既有 `production-evidence` 缺失而拒絕；正式 Owner UI manifest 與 `config/artifacts.json releaseEligible=false` 均未修改。這不允許把 staging 候選當成正式 Release。

## 下一個可執行步驟

取得限定 `zhudatuan-staging` 的阿里雲／Cloudflare 管理權限，或由 Owner 先建立下列資源並只提供 Secret Reference：

- staging RDS PostgreSQL 與 API／Jobs／Migration／Bootstrap 專用角色，以及只映射該 RDS 的 `127.0.0.1:55442` loopback proxy；
- staging Redis；
- full-staging Internal Runtime 的獨立 TLS、catalog、KMS master key，以及一個共用 Secret Store token 和一個不同的共用 KMS token；
- external staging Object Store endpoint、token ref 與 bucket 隔離證據；不得用 Secret／KMS-only Internal Runtime 冒充；
- 品牌 staging 三個 Host 及 Access policy，或只用於臨時驗收且 ACME 實測成功的 sslip.io Host；
- 完整 Jobs Secret refs，或明確批准先以 identity-only worker 完成短信驗收。

資源齊備且 8643／8644 readiness 通過後，才可依序執行 Migration、boundary reconciliation、`BootstrapStagingOwner`，再由 authenticated Owner invitation API 建立／撤銷邀請並完成真手機短信與 Console 登入 E2E。`BootstrapRegistration` 在本 profile 禁止執行。

## 回退

本輪只在 ECS 新增上述 inactive release 目錄與 tar 封存；未修改 Cloudflare、阿里雲資源、資料庫、服務配置或正式流量，因此不需要運行態回退。若 Owner 決定撤回，僅需另行確認後刪除這兩個精確候選路徑；不得刪除現有 ECS Release、`current` 或資料卷。本地分支／worktree 保留作審計與後續 provision 輸入。
