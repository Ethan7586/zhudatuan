# 隔離公網預發布 Profiles

此目錄提供兩個必須顯式選擇、不能混用的 staging profile：

- `identity-sms`：可選的最小身份／短信 profile，運行 `IdentityRegistrationApiMain` 與 `IdentityNotificationJobsOnlyMain`，不用 Redis。
- `full`：Owner 已批准的目標 profile，運行同一個最小公網身份 API，並以 `JOB_RUNTIME_PROFILE=full` 從 `JobsMain.js` 進入已 bundle 的最新 `FullJobsMain.ts`。

沒有通用 `ecosystem.config.cjs` 或 `Caddyfile`，因此操作員必須在命令中寫出 profile。兩個 profile 使用不同 Release／shared／log 路徑、不同進程名、不同 Host 變量及不同 API port，不能靠父進程環境偷偷切換。

目前 `full` 只是 fail-closed 的可部署合同，`delivery.yml` 明確標為 `deployable: false`。獨立 RDS、Redis、Secret Catalog、KMS、Object Store、完整 Provider 配置、DNS／TLS 與 Edge Access 的實際證據未進入倉庫前，不得啟動、不得稱為已接通。

## 公網路由邊界

兩個 profile 都只把身份 API 的精確 method/path 放到公網。Owner 邀請新增路由如下：

- `POST /api/v1/identity/invitations`
- `DELETE /api/v1/identity/invitations/{id}`，Caddy 以 `^/api/v1/identity/invitations/[^/]+$` 限制為單一 ID segment，禁止 `*` wildcard。
- 對應的精確 `OPTIONS` preflight。

這只是邊緣放行；API 內仍必須通過 authenticated operator policy、權限、scope、step-up／風險及審計合同。Caddy 不提供任何身份繞過。其餘註冊、登入、session 路由保持既有 allowlist，未命中的請求一律 404。

## Profile 隔離

| 合同       | `identity-sms`                        | `full`                                    |
| ---------- | ------------------------------------- | ----------------------------------------- |
| Release    | `/opt/zhudatuan-staging/current`      | `/opt/zhudatuan-staging-full/current`     |
| Shared     | `/opt/zhudatuan-staging/shared`       | `/opt/zhudatuan-staging-full/shared`      |
| API port   | `127.0.0.1:4421`                      | `127.0.0.1:4431`                          |
| Jobs entry | `IdentityNotificationJobsOnlyMain.js` | `JobsMain.js` → bundled `FullJobsMain.ts` |
| Redis      | 禁止／不用                            | 獨立 staging Redis，必需                  |
| Caddy      | `Caddyfile.identity-sms`              | `Caddyfile.full`                          |
| PM2        | `ecosystem.identity-sms.config.cjs`   | `ecosystem.full.config.cjs`（API／Jobs）  |
| 內部服務   | 不適用                                | systemd：Secret Store 8643／KMS 8644      |

兩者都不得引用 `/opt/zhudatuan/current`、正式域名、正式資料庫、正式 Redis、正式 Object Store 或正式 Secret namespace。

## Full 外部資源前置條件

在把 `delivery.yml` 的 `deployable` 改為 `true` 前，必須把以下證據放進受控 Release 記錄，而不是只提供口頭名稱：

1. 隔離 RDS PostgreSQL 的私網 endpoint、database identity、snapshot、PITR 與還原演練證據。
2. `zhudatuanidentityapi`、`shopjob`、`shopmigration`、`zhudatuanbootstrap` 四個最小角色；API／Jobs／Migration 使用不同 DSN Secret Reference。
3. 獨立 staging Redis 或等價 VPC／ACL 硬邊界，`zhudatuan-staging/full/redis/jobs` 絕不能解析到正式 Redis。
4. 一套只屬於 full staging 的 Internal Runtime：Secret Store 固定 `127.0.0.1:8643`、KMS 固定 `127.0.0.1:8644`，catalog、KMS master key 及 Bearer 都不得復用正式驗收環境。現有 runtime 每個服務只支援單一 Bearer，因此 API／Jobs／Migration／Staging Owner 共用一個 Secret Store Bearer，API／Jobs／Migration 共用一個 KMS Bearer；Secret Store 與 KMS 的 Bearer 必須互不相同。
5. `WECHAT_APPLICATION_CONFIG_REF`、`WECHAT_PAYMENT_CONFIG_REF`、`INVOICE_CONFIG_REF`、`PAYOUT_CONFIG_REF`、`NOTIFICATION_CONFIG_REF`、`EXTENSION_MANIFEST_KEY_REF`、Object Store endpoint/token 全套 sandbox 配置。
6. 阿里雲短信簽名、驗證模板、運營商報備與 ECS RAM Role；不得在 env 或 Secret JSON 保存長期 AccessKey。
7. Full 三個獨立 Host、TLS 與 Edge Access policy；production traffic 固定為 0。

`NOTIFICATION_CONFIG_REF` 不是 identity-only 的 `IDENTITY_NOTIFICATION_CONFIG_REF`。Full secret 必須是 runtime 要求的 `sms`、`email`、`wechat` 三段完整 JSON；其中短信使用已審批 staging 簽名／模板與 RAM Role。缺任一 ref、Bearer、Redis 或 provider configuration，官方 env validator／runtime constructor 都會拒絕啟動。

## RDS 與 loopback proxy 合同

Runtime 的三個資料庫 Secret 必須解析為隔離 RDS DSN，且連線後身份分別為：

- API：`zhudatuanidentityapi`
- Full Jobs：`shopjob`
- Migration：`shopmigration`

`BootstrapStagingOwner` 有 staging 專用的安全邊界：只接受 `zhudatuanbootstrap@127.0.0.1:55442/zhudatuan_registration`，Secret Store 只接受 `https://127.0.0.1:8643`。因此執行此一次性制品前必須先建立：

- 僅綁定 `127.0.0.1:55442` 的資料庫 proxy，唯一 upstream 是隔離 staging RDS 私網 endpoint；proxy 對上游強制 TLS 與 CA 驗證。
- 由本 profile 的 `InternalRuntimeMain.js` 在 `127.0.0.1:8643` 提供獨立 Secret Store；不得把既有正式驗收的 `8543`／`8544` 映射或轉發給 staging。
- Secret Store 還必須提供獨立、至少 32 字元的高熵 bootstrap receipt；它只用於重跑一致性，不得由 Owner 密碼派生，且 reference 不得與 identity key／Owner password 相同。

禁止把任何正式 endpoint 映射到上述 loopback listener。安全組只允許 staging workload 主機到 staging RDS／Redis，RDS 不開公網。啟動前以不輸出 DSN 的方式核對：

```bash
psql "$STAGING_BOOTSTRAP_LOOPBACK_DSN" -XAtc "select current_database(),current_user,inet_server_addr(),pg_is_in_recovery()"
```

預期 database 為 `zhudatuan_registration`、role 為 `zhudatuanbootstrap`、非 recovery；`inet_server_addr()` 必須與已登記的 staging RDS 私網身份相符。不要把 DSN、password 或 sentinel 寫進 shell history／日誌。

## Migration 與 Staging Owner 制品清單

完整清單在 `artifacts.yml`，一次性執行順序固定：

1. `services/commerce/dist/MigrationMain.js`
2. `infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql`
3. `services/commerce/dist/BootstrapStagingOwner.js`

Full 使用通用 `MigrationMain.js`；`RegistrationMigrationMain.js` 釘死非 staging path/ref，因此明確排除。倉庫也不會產生獨立 `FullJobsMain.js`：`FullJobsMain.ts` 由 `JobsMain.js` bundle，Release 驗證必須同時確認 bundle 內有 `JOB_RUNTIME_CATALOG_DRIFT` marker。

Migration 之前必須有可還原 snapshot；Staging Owner bootstrap 之前必須完成 boundary reconciliation。公開邀請改由通過 authenticated operator policy 的 invitation create／revoke API 執行，`BootstrapRegistration.js` 在本 profile 明確禁止。任何一步失敗都停止，不得啟動 API／Jobs，也不得只回退程式而不恢復測試資料庫。

## 準備 Full Runtime 文件

先建立隔離目錄，再把 example 複製到主機外部。所有 `.invalid`、`replace-*`、`REPLACE_*` 都是刻意保留的 blocker；未替換不得啟動。

```bash
install -d -m 0750 /opt/zhudatuan-staging-full/shared/tls /var/log/zhudatuan-staging-full
install -m 0600 infrastructure/zhudatuan/aliyun/staging/full-identity-registration-api.env.example /opt/zhudatuan-staging-full/shared/full-identity-registration-api.env
install -m 0600 infrastructure/zhudatuan/aliyun/staging/full-jobs.env.example /opt/zhudatuan-staging-full/shared/full-jobs.env
install -m 0600 infrastructure/zhudatuan/aliyun/staging/full-internal-runtime.env.example /opt/zhudatuan-staging-full/shared/full-internal-runtime.env
install -m 0600 infrastructure/zhudatuan/aliyun/staging/full-migration.env.example /opt/zhudatuan-staging-full/shared/full-migration.env
install -m 0600 infrastructure/zhudatuan/aliyun/staging/full-owner-bootstrap.env.example /opt/zhudatuan-staging-full/shared/full-owner-bootstrap.env
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-internal-runtime.service /etc/systemd/system/zhudatuan-staging-full-internal-runtime.service
```

另需以 `0600` 安裝 `full-secrets.json`、Internal Runtime TLS private key、憑證與 CA。catalog 必須完整包含 `delivery.yml` 的 `catalogKeys`，但不得包含正式 endpoint 或正式 Secret；其值與 master key 都不進 Git。`LOCAL_RUNTIME_PROFILE=registration-only` 是現有 bundler 用來只啟動 Secret Store／KMS 的名稱，不代表它可提供完整 Object Store；Full Jobs 的 Object Store 仍是外部 staging provider，未 provision 前保持 blocker。所有 env 檔維持 `0600`。

## 構建同一候選版本

以下 Host 必須是隔離 Full Host；Auth／Console 的 API Origin 必須與 Caddy profile 一致：

2026-08-29 的只讀審計顯示品牌 staging DNS 仍為 NXDOMAIN，且當前沒有 Cloudflare token。臨時公網驗收可把所選 profile 的三個 env-driven Host 設為 `accounts.staging.123-57-232-253.sslip.io`、`console.staging.123-57-232-253.sslip.io`、`api.staging.123-57-232-253.sslip.io`；三者已驗證會解析到 `123.57.232.253`。這只是 sslip.io 臨時解析，不是品牌 staging DNS，Caddy ACME／HTTPS 能否成功仍必須在部署時實測；證書未成功前不得開始公網驗收。

```bash
export ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST=accounts.staging.123-57-232-253.sslip.io
export ZHUDATUAN_STAGING_FULL_CONSOLE_HOST=console.staging.123-57-232-253.sslip.io
export ZHUDATUAN_STAGING_FULL_API_HOST=api.staging.123-57-232-253.sslip.io

VITE_API_BASE_URL="https://${ZHUDATUAN_STAGING_FULL_API_HOST}" VITE_AUTH_STAGING_API_ORIGIN="https://${ZHUDATUAN_STAGING_FULL_API_HOST}" VITE_ADMIN_ORIGIN="https://${ZHUDATUAN_STAGING_FULL_CONSOLE_HOST}" VITE_AUTH_STAGING_ADMIN_ORIGIN="https://${ZHUDATUAN_STAGING_FULL_CONSOLE_HOST}" VITE_STOREFRONT_ORIGIN="https://disabled.full.staging.example.invalid" VITE_AUTH_STAGING_STOREFRONT_ORIGIN="https://disabled.full.staging.example.invalid" VITE_CLIENT_VERSION="0.0.0-staging" npm run build:auth
VITE_API_BASE_URL="https://${ZHUDATUAN_STAGING_FULL_API_HOST}" VITE_AUTH_BASE_URL="https://${ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST}" VITE_CLIENT_VERSION="0.0.0-staging" npm run build:console
npm run build:commerce
```

對乾淨 checkout 產生 `artifacts.yml` 所列制品的 SHA-256 清單，通過後才可複製至 `/opt/zhudatuan-staging-full/current`。清單中的 `inventory-only-not-provisioning-evidence` 不代表任何雲資源已存在。

## 驗證與啟動

先執行 repository check、官方 env validators、Caddy 原生驗證：

```bash
node infrastructure/zhudatuan/aliyun/staging/check.mjs
npx tsx infrastructure/zhudatuan/aliyun/staging/validate-environments.ts
caddy validate --config infrastructure/zhudatuan/aliyun/staging/Caddyfile.full --adapter caddyfile
```

所有檔案與外部前置證據備妥後，先啟動 staging 專用 Internal Runtime，確認它只綁 loopback 且 readiness 通過；systemd 擁有該服務，PM2 不得重複啟動：

```bash
systemctl daemon-reload
systemctl enable --now zhudatuan-staging-full-internal-runtime.service
systemctl is-active zhudatuan-staging-full-internal-runtime.service
ss -lnt | grep -E '127\.0\.0\.1:(8643|8644)'
```

Internal Runtime 可用後，依 `MigrationMain.js`、boundary reconciliation、`BootstrapStagingOwner.js` 的固定順序執行一次性步驟。全數成功後，才可顯式啟動 Full API／Jobs profile：

```bash
pm2 startOrReload infrastructure/zhudatuan/aliyun/staging/ecosystem.full.config.cjs --update-env
pm2 status zhudatuan-staging-full-identity-api zhudatuan-staging-full-jobs
caddy reload --config infrastructure/zhudatuan/aliyun/staging/Caddyfile.full --adapter caddyfile
curl --fail --silent http://127.0.0.1:4431/health/ready
```

`JobsMain` 沒有假的 HTTP readiness port；PM2 online 只表示 process 未退出。真正驗收還必須取得 runtime compatibility、Job catalog、Redis、Outbox／Scheduler、測試短信 BizId 與 operator invitation create/revoke 的 E2E 證據。

回退時只停止選中的 staging 進程、恢復同一 profile 的上一個已驗證 Release，並按 snapshot／PITR 計畫處理隔離資料庫；不切正式流量、不修改正式資料。
