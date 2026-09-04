# 隔離預發布配置

此目錄只服務築大團隔離預發布環境，不是正式部署輸入。它提供 Auth／Console 靜態制品、Canonical API 與 `01_core_hexin/services/commerce/dist/JobsMain.js`，且不包含正式域名、正式 DNS、正式資料或正式流量切換。

## 隔離合同

- Release、shared、log 分別固定在 `/opt/zhudatuan-staging/current`、`/opt/zhudatuan-staging/shared`、`/var/log/zhudatuan-staging`；不得指向正式路徑。
- API 使用 `shopapp` 測試庫角色，Jobs 使用 `shopjob` 測試庫角色；兩個 Secret Reference 必須指向同一套隔離預發布 RDS 的不同最小權限身份。
- Redis、Secret Store、KMS、Object Store 和 `NOTIFICATION_CONFIG_REF` 必須全部使用 staging Scope。Secret 值不得進 Git 或 PM2 配置。
- 公網入口 Host 只從 `ZHUDATUAN_STAGING_ACCOUNTS_HOST`、`ZHUDATUAN_STAGING_CONSOLE_HOST`、`ZHUDATUAN_STAGING_API_HOST` 取得。邊緣存取控制完成前不得暴露入口。
- `APP_ENV=production` 是刻意的：公網預發布沿用正式安全行為，禁止測試登入與調試驗證碼；環境隔離由路徑、Host、資料身份和 Secret Scope 保證。

## 準備

從 `.env.example` 建立主機外部環境檔，替換所有 `.invalid` 與 `replace-*` 佔位，並限制權限：

```bash
install -d -m 0750 /opt/zhudatuan-staging/shared /var/log/zhudatuan-staging
install -m 0600 02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/.env.example /opt/zhudatuan-staging/shared/.env.staging
```

`NOTIFICATION_CONFIG_REF` 指向的 Secret 必須包含已審批的測試短信簽名、驗證碼模板、HTTPS Endpoint、Region 與 RAM Role；優先使用 ECS RAM Role／工作負載身份，不在 JSON 或環境檔保存長期 AccessKey。其餘 email／wechat 欄位仍須符合 Delivery Configuration 合同，即使本輪只驗收短信。

將同一個候選版本的以下制品放入 `/opt/zhudatuan-staging/current`：

```text
01_core_hexin/apps/auth-web/dist/
01_core_hexin/apps/console/dist/
01_core_hexin/services/commerce/dist/ApiMain.js
01_core_hexin/services/commerce/dist/JobsMain.js
node_modules/
```

## 驗證與啟動

先執行倉庫內靜態合同：

```bash
node 02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/check.mjs
```

設定三個非正式 Host 後驗證 Caddy；此步只驗配置，不建立或修改 DNS：

```bash
export ZHUDATUAN_STAGING_ACCOUNTS_HOST=accounts-staging.example.test
export ZHUDATUAN_STAGING_CONSOLE_HOST=console-staging.example.test
export ZHUDATUAN_STAGING_API_HOST=api-staging.example.test
caddy validate --config 02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/Caddyfile --adapter caddyfile
caddy reload --config 02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/Caddyfile --adapter caddyfile
```

在 staging 主機上啟動獨立 PM2 進程：

```bash
pm2 startOrReload 02_platform_pingtai/infrastructure/zhudatuan/aliyun/staging/ecosystem.config.cjs --update-env
pm2 status zhudatuan-staging-api zhudatuan-staging-jobs
curl --fail --silent http://127.0.0.1:3101/health/ready
```

API 健康檢查通過只代表依賴可用。Jobs 驗收還須確認 `zhudatuan-staging-jobs` 持續存活、使用 `shopjob` 角色取得 Lease，並以測試收件人完成一筆通知 Outbox → 阿里雲短信回執；不得使用正式收件人或正式資料。

回退時先停止兩個 staging 進程，再把 `/opt/zhudatuan-staging/current` 恢復到上一個已驗證候選版本並用相同命令重載。任何 Migration 回退必須搭配隔離測試庫快照，不可只回退程式。
