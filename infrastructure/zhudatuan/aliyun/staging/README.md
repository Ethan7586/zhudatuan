# 隔離身份與短信預發布配置

此目錄只用於隔離公網預發布的身份註冊、登入及阿里雲真短信驗收。它部署 Auth／Console 靜態制品、`IdentityRegistrationApiMain` 和 `IdentityNotificationJobsOnlyMain`，不包含正式域名、正式 DNS、正式資料或正式流量切換。

> `IdentityNotificationJobsOnlyMain` 不是完整 `JobsMain`。它只 claim `identitynotification` 任務並發送身份驗證短信；不運行通用 Outbox Relay、Scheduler、支付、退款、履約、對賬、發票、Provider、Object Store 或其他 Commerce Jobs。完整 Jobs 驗收需要另一份明確批准和依賴齊全的隔離配置。

## 隔離合同

- Release、shared、log 分別固定在 `/opt/zhudatuan-staging/current`、`/opt/zhudatuan-staging/shared`、`/var/log/zhudatuan-staging`，不得指向正式路徑。
- API 必須使用隔離 RDS 的 `zhudatuanidentityapi` 角色；短信 worker 必須使用 `zhudatuanidentityjob`。兩者使用不同的資料庫 Secret Reference。
- API 與 worker 使用不同的外部 env 檔、Secret Store Bearer 和 KMS Bearer。PM2 透過 `/usr/bin/env -i` 清空父進程環境後再啟動，避免配置串線。
- 公網 Host 只從 `ZHUDATUAN_STAGING_ACCOUNTS_HOST`、`ZHUDATUAN_STAGING_CONSOLE_HOST`、`ZHUDATUAN_STAGING_API_HOST` 取得；邊緣存取控制完成前不得暴露入口。
- Registration API 固定 `APP_ENV=test`，因 production profile 會鎖定正式 Origin；它仍固定 `AUTH_MODE=membership`、loopback bind 及最小 API profile。短信 worker 固定 `APP_ENV=production`，不提供調試驗證碼。
- 此最小 worker 使用 PostgreSQL 專用 Queue，不使用 Redis。不得為了「看似完整」加入支付、微信、發票或其他無關 refs。

## 準備 Runtime 環境

建立獨立目錄，將兩份 example 複製到主機外部並替換全部 `.invalid`、`replace-*` 與 `REPLACE_*` 佔位：

```bash
install -d -m 0750 /opt/zhudatuan-staging/shared /opt/zhudatuan-staging/shared/tls /var/log/zhudatuan-staging
install -m 0600 infrastructure/zhudatuan/aliyun/staging/identity-registration-api.env.example /opt/zhudatuan-staging/shared/identity-registration-api.env
install -m 0600 infrastructure/zhudatuan/aliyun/staging/identity-notification-jobs.env.example /opt/zhudatuan-staging/shared/identity-notification-jobs.env
```

另須把只信任 staging 內部 Secret Store／KMS 的 CA 證書安裝為 `/opt/zhudatuan-staging/shared/tls/internal-ca.crt`；不得以正式環境的私密信任材料代替。

`IDENTITY_NOTIFICATION_CONFIG_REF` 必須在 staging Secret Store 中解析為且僅解析為：

```json
{
  "sms": {
    "signName": "已審批的測試短信簽名",
    "verificationTemplate": "SMS_12345678",
    "endpoint": "dysmsapi.aliyuncs.com",
    "region": "cn-hangzhou",
    "roleName": "staging-identity-notification-role"
  }
}
```

使用 ECS RAM Role／工作負載身份，不在 Git、env 或 Secret JSON 中保存長期 AccessKey。簽名、模板和運營商報備未通過時，真短信驗收仍會失敗。

## 構建同一候選版本

先設定三個非正式 Host。Auth 的 staging Origin 必須在構建時雙重鎖定，Console 也必須指向同一 API／Auth Host：

```bash
export ZHUDATUAN_STAGING_ACCOUNTS_HOST=accounts-staging.example.test
export ZHUDATUAN_STAGING_CONSOLE_HOST=console-staging.example.test
export ZHUDATUAN_STAGING_API_HOST=api-staging.example.test

VITE_API_BASE_URL="https://${ZHUDATUAN_STAGING_API_HOST}" VITE_AUTH_STAGING_API_ORIGIN="https://${ZHUDATUAN_STAGING_API_HOST}" VITE_ADMIN_ORIGIN="https://${ZHUDATUAN_STAGING_CONSOLE_HOST}" VITE_AUTH_STAGING_ADMIN_ORIGIN="https://${ZHUDATUAN_STAGING_CONSOLE_HOST}" VITE_STOREFRONT_ORIGIN="https://disabled.staging.example.invalid" VITE_AUTH_STAGING_STOREFRONT_ORIGIN="https://disabled.staging.example.invalid" VITE_CLIENT_VERSION="0.0.0-staging" npm run build:auth
VITE_API_BASE_URL="https://${ZHUDATUAN_STAGING_API_HOST}" VITE_AUTH_BASE_URL="https://${ZHUDATUAN_STAGING_ACCOUNTS_HOST}" VITE_CLIENT_VERSION="0.0.0-staging" npm run build:console
npm run build:commerce
```

將同一提交構建的以下制品放入 `/opt/zhudatuan-staging/current`：

```text
apps/auth-web/dist/
apps/console/dist/
services/commerce/dist/IdentityRegistrationApiMain.js
services/commerce/dist/IdentityRegistrationApiReadyMain.js
services/commerce/dist/IdentityNotificationJobsOnlyMain.js
services/commerce/dist/IdentityNotificationJobsReadyMain.js
node_modules/
```

## 驗證與啟動

先執行倉庫內合同和原生配置驗證：

```bash
node infrastructure/zhudatuan/aliyun/staging/check.mjs
caddy validate --config infrastructure/zhudatuan/aliyun/staging/Caddyfile --adapter caddyfile
```

確認兩個 env 檔只包含各自 allowlist，再在 staging 主機啟動：

```bash
pm2 startOrReload infrastructure/zhudatuan/aliyun/staging/ecosystem.config.cjs --update-env
pm2 status zhudatuan-staging-identity-api zhudatuan-staging-identity-notification-jobs
caddy reload --config infrastructure/zhudatuan/aliyun/staging/Caddyfile --adapter caddyfile
curl --fail --silent http://127.0.0.1:4421/health/ready
```

API 健康檢查只代表最小身份 Runtime 可用。完整驗收還必須以測試邀請碼和測試手機完成：建立 Challenge → `runtime.job` 產生 `identitynotification` → worker 以 `zhudatuanidentityjob` claim → KMS 解密 → 阿里雲返回 `bizId` → 驗證碼完成註冊／登入。不得使用正式收件人或正式資料。

回退時只停止兩個 `zhudatuan-staging-*` 進程，恢復 `/opt/zhudatuan-staging/current` 到上一個已驗證候選版本後重載。任何 Migration 回退必須搭配隔離測試庫快照，不可只回退程式。
