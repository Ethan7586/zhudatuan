# 主打團獨立註冊、WebBusiness 與 Purchase 驗收棧

這套配置只用於目前單機 ECS 的 MVP 驗收，不冒充正式 ACK／RDS 生產拓撲。已批准的 3003 登入與註冊界面不在此處修改。

## 隔離邊界

- 正式工程：`/opt/zhudatuan/releases/<commit>`，`/opt/zhudatuan/current` 只指向已驗證 Release。
- 每次创建候选版本前必须执行 `/usr/local/sbin/zhudatuan-release-policy preflight`；低于磁盘门槛或版本数量超限时停止发布。
- 每次成功、失败或回滚收口后必须执行 `/usr/local/sbin/zhudatuan-release-policy postdeploy`。服务器同时监听正式指针变化并每小时补扫一次，不再依赖执行者记得手工清理。
- 自动回收永远跳过当前、上一版、回滚指针、运行中版本、版本依赖和人工固定版本；数据库备份与媒体目录不属于发布垃圾回收范围。
- 私密配置：`/opt/zhudatuan/shared`，不得進入 Git 或 Release archive。
- 狀態資料：`/var/lib/zhudatuan/postgres`；窄版註冊 API、WebBusiness API、Purchase API／Jobs 不啟動 Redis 或 Object Store。
- Identity Registration API：`127.0.0.1:4321`；只公開 health 與 Identity。
- WebBusiness API：`127.0.0.1:4322`；只公開 Caddy allowlist 內的 Console／Storefront 路徑。
- Purchase API：`127.0.0.1:4323`；只接受 quote、order create、payment intent 三條精確 POST 路徑，以及相同三條路徑的 OPTIONS preflight。
- PostgreSQL：`127.0.0.1:55432`。
- Secret Store／KMS：`127.0.0.1:8543/8544`。
- 禁止讀取或連接 `/opt/smart-wing`、`/opt/smart-wiston`、`/opt/shop-test`、5432、16379、8443–8445、3000、3001。

## 失敗關閉順序

1. 從乾淨 Git commit 產生不可變 Release；驗證 SHA-256 與 `02_platform_pingtai/config/owner-approved-ui.json`。
2. 建立獨立資料目錄、專用 `zhudatuan` 系統帳號及 0600 私密配置。
3. 由 `zhudatuan-registration-database.service` 啟動 `registration-compose.yml` 的單一 PostgreSQL，只接受 `127.0.0.1:55432`。
4. 啟動 `zhudatuan-internal-runtime.service`；它只執行已 bundle 的 `InternalRuntimeMain.js`，Secret Store 與 KMS 兩個 readiness 全部成功後才成為 active。
5. 執行 `zhudatuan-migration.service`；它只執行已 bundle 的 `01_core_hexin/services/commerce/dist/RegistrationMigrationMain.js`，不會讀 `.env.local`、`tsx` 或寫入原碼。完整 migration inventory、歷史雜湊、受管 repair 順序與最終 head `20260902133000` 任一不一致即停止；Purchase E2E receipt 仍鎖定其支付邊界版本 `20260902011000` 與規範化 checksum。
6. Migration 完成後，以資料庫 cluster owner 執行一次版本化的 `postgres-reconcile-registration-boundary.sql`，只修復既有資料卷中 `zhudatuanbootstrap → SECURITY DEFINER(shopmigration) → registration_bootstrap_boundary` 的嵌套 EXECUTE 鏈；不得在伺服器互動式手寫 GRANT。正式命令如下：

```sh
sudo docker compose --env-file /opt/zhudatuan/shared/postgres.env \
  -f /opt/zhudatuan/current/02_platform_pingtai/infrastructure/zhudatuan/aliyun/registration-compose.yml \
  exec -T postgres sh -eu -c 'psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1' \
  < /opt/zhudatuan/current/02_platform_pingtai/infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql
```

7. 啟動 `zhudatuan-api.service`、`zhudatuan-web-api.service`、`zhudatuan-purchase-api.service` 與 `zhudatuan-identity-notification-jobs.service`。四者分別只能執行 `IdentityRegistrationApiMain.js`、`WebBusinessApiMain.js`、`PurchaseApiMain.js` 與 `IdentityNotificationJobsOnlyMain.js`；profile、loopback host 與 port 均由 systemd 固定，不接受 env 降級。
8. 在不公開網域的情況下完成邀請、真短信 BizId、OTP、建立會員、重複手機 409、Console scope 載入、Storefront 商品／購物車／訂單讀取、三條 Purchase command 及審計驗收。WebBusiness 驗收不得載入 Finance、Payment Provider 或舊 Commerce API；Purchase 驗收不得暴露 refund、webhook、recovery 或管理操作。
9. `api.zhudatuan.com` 的 Cloudflare DNS 與 Caddy API 分流已存在；每次 Release 仍須先驗證活動 Caddy：Identity／health 指向 4321，精確 WebBusiness allowlist 指向 4322，Purchase 三條 POST 與同路徑 OPTIONS 在 E2E receipt 產生前維持 503，其他路徑維持 404。只有全部驗收通過後才可切換其餘公開入口。

## 必須由 Owner／供應商提供

- 主打團可用的阿里雲 SMS 簽名。
- 變數為 `code` 的驗證碼模板 Code。
- 對應的最小權限 RAM Role，或只允許 `SendSms` 的獨立 AK/SK。

缺少任何一項時，公開註冊必須保持關閉；不得回傳假驗證碼、不得把排隊成功冒充短信送達，也不得借用舊 Smart Wing 配置。

## 服務管理與環境白名單

- PM2 只管理靜態 Storefront；API 與 Jobs 只能由上述 systemd units 管理，禁止雙 supervisor。
- `/opt/zhudatuan/shared/api.env` 必須逐鍵取自 `identity-registration-api.env.example`；任何 Redis、Payment、Provider、Finance、WeChat、Object Store 或 Extension 變數都會令 API fail closed。
- `/opt/zhudatuan/shared/web-business-api.env` 必須逐鍵取自 `web-business-api.env.example`；不得放入 profile、host、port、Redis、Payment、Provider、Finance、WeChat、Object Store 或 Extension 變數。
- `/opt/zhudatuan/shared/purchase-api.env` 必須逐鍵取自 `purchase-api.env.example`；只可包含獨立 DB、quote key、Secret Store、KMS、兩個精確 WeChat 配置 ref 與內部 CA，不得放入 profile、host、port、Redis、Session、Identity、Finance、Object Store 或 Extension 變數。
- `/opt/zhudatuan/shared/identity-notification-jobs.env` 必須逐鍵取自 `identity-notification-jobs.env.example`；任何 full Jobs 依賴都會令 worker fail closed。
- Units 對 `/opt/smart-wing`、`/opt/smart-wiston`、`/opt/shop-test` 使用 `InaccessiblePaths`，不得讀取舊服務工作樹。

以下檔案必須逐鍵從同名 `.example` 建立，權限 `0600`，不得合併成一個共用 env：

- `/opt/zhudatuan/shared/postgres.env`：僅 PostgreSQL 與 10 個專用角色密碼，資料庫名固定 `zhudatuan_registration`，並含獨立隨機 sentinel。
- `/opt/zhudatuan/shared/runtime.env`：僅 TLS、Secret Store 與 KMS。
- `/opt/zhudatuan/shared/migration.env`：僅 Migration allowlist；目錄固定為 Release 內 migrations。
- `/opt/zhudatuan/shared/api.env`：僅 registration-only API allowlist。
- `/opt/zhudatuan/shared/web-business-api.env`：僅 web-business-only API allowlist，使用獨立 `zhudatuanwebapi` 資料庫角色與獨立 workload token。
- `/opt/zhudatuan/shared/purchase-api.env`：僅 purchase-only API allowlist，使用獨立 purchase 資料庫角色、Secret Store／KMS workload token與精確 WeChat application／payment 配置 ref。
- `/opt/zhudatuan/shared/identity-notification-jobs.env`：僅 identity notification worker allowlist。
- 一次性邀請才使用 `registration-bootstrap.env.example`；必須由 `zhudatuanbootstrap` 連至固定 loopback／port／DB，並通過該 DB 初始化的不可寫 sentinel。生產只執行已編譯的 `01_core_hexin/services/commerce/dist/BootstrapRegistration.js`，禁止在 Release 上用 `tsx` 即時編譯。
- 一次性原生商品驗收才使用 `sandbox-catalog-bootstrap.env.example`；必須由 `zhudatuansandboxbootstrap` 連至固定 loopback／port／DB，且只可在 `APP_ENV=test` 執行。完成後刪除該私密 env。
- 一次性會員資格驗收才使用 `sandbox-member-qualification-bootstrap.env.example`；它只接受一個已完成正式註冊的 storefront membership，只建立最小 active qualification profile 與鎖定的 audit chain，不建立福利帳戶、不發放福利金。完成後刪除該私密 env。
- 一次性福利金驗收才使用 `sandbox-member-welfare-bootstrap.env.example`；必須由 Owner 手動填入同一個已通過資格 one-shot 的 membership、明確正整數 minor amount、`CNY` 與完整確認字串。它不是註冊副作用，也沒有公開 route；完成後刪除該私密 env。
- 一次性 Console Owner 初始化才使用 `owner-bootstrap.env.example`；密碼只存放在 loopback Secret Store，公開註冊永遠不能取得 Owner 或 `role:self` 以外的後台角色。

## Sandbox Purchase 驗收資料

這三個 one-shot 只能在獨立 test DB、乾淨 Release checkout 中依序執行；各自從同名 `.env.example` 建立 0600 私密檔，再執行：

```sh
node --env-file=/opt/zhudatuan/shared/sandbox-catalog-bootstrap.env \
  --import tsx 04_tools/tools/seed/src/BootstrapSandboxCatalog.ts
node --env-file=/opt/zhudatuan/shared/sandbox-member-qualification-bootstrap.env \
  --import tsx 04_tools/tools/seed/src/BootstrapSandboxQualification.ts
node --env-file=/opt/zhudatuan/shared/sandbox-member-welfare-bootstrap.env \
  --import tsx 04_tools/tools/seed/src/BootstrapSandboxWelfare.ts
```

三個命令可安全重跑，分別鎖定商城 audit chain 與單一 membership。Catalog one-shot 建立 active mall application、publication、商品／SKU／pool／listing、價格與庫存；qualification one-shot 只啟用該已註冊會員的最小資格；welfare one-shot 只依 Owner 明填的 amount 建立 30 日 sandbox welfare lot、canonical 雙分錄與完整 audit，重跑不同 amount 會衝突失敗，絕不追加發放。

Quote → order → internal benefit capture 可使用正式 canonical 福利發放流程，或僅在此獨立 test DB 使用上述 Owner-operated welfare one-shot。不得把餘額放進 migration、catalog、qualification 或註冊流程；未實際完成三段 E2E 前，`publicCutoverRequiresPurchaseE2e` 必須維持阻斷，且 `release.publicCutover` 必須為 `blocked`。

未來 E2E receipt 必須符合 `purchase-e2e-receipt.schema.json` v2，綁定 Release commit、`20260902011000` 規範化 checksum、production target、資料庫名稱／server fingerprint、`zhudatuanpurchaseapi` 角色，以及 quote、order、WeChat prepay、attempt／prepay 持久化、主動查單、capture、庫存、履約、outbox、冪等重放、重複渠道結果、故障恢復、商城隔離、回滾、負向路由與 audit 證據。本地已有真 PostgreSQL 17 角色鏈路驗收，但尚未完成生產微信渠道 E2E，因此不得建立 receipt；`delivery.yml` 的 receipt 必須保持 `null`，公開 Purchase POST／OPTIONS 由 Caddy 精確回覆 503，僅可從 loopback 直連 4323 驗收。

## Secret Store／KMS 工作負載認證

- `runtime.env` 必須各自配置獨立、至少 43 個 base64url 字元的 `LOCAL_SECRET_STORE_BEARER_TOKEN` 與 `LOCAL_KMS_BEARER_TOKEN`，兩者不得相同。
- API、Jobs、Migration 與一次性 Bootstrap 的私有 `0600` env 檔，只按需要取得對應的 `SECRET_STORE_BEARER_TOKEN`／`KMS_BEARER_TOKEN`；不得把 server-side `LOCAL_*` 名稱或另一服務的 token 注入不需要它的工作負載。
- `/health/ready` 是唯一可匿名請求的內部路徑；Secret Store 與 KMS 的其他路徑必須先以固定時間比較驗證 bearer，再處理 method、path 或 body。
- Token 不得放入 Release、Git、命令列、URL 或日誌。輪換時先以相同值原子更新 server/client 的私有 env，依序重啟 internal runtime 與相依工作負載，驗證完成後才撤銷舊值。

## Console Owner 一次性初始化

完成 `zhudatuan-migration.service` 後，先把獨立身份 HMAC key 與 Owner 密碼寫入 Secret Store；不得把明文密碼寫入 env、命令列、日誌或 Release。逐鍵建立權限 `0600` 的 `/opt/zhudatuan/shared/owner-bootstrap.env`，再執行：

```sh
sudo systemctl start zhudatuan-owner-bootstrap.service
sudo systemctl status --no-pager zhudatuan-owner-bootstrap.service
```

成功輸出只包含 `created`／`existing`、固定 principal 與 membership ID。腳本只可建立一個 `tenant-zhudatuan` Console operator，綁定 `role-platform-owner-v2`、`role:self` 與 platform／tenant／self scopes；任何第二個 Owner、固定 ID 漂移、密碼漂移、非 loopback DB／Secret Store 或 sentinel 不符都會失敗關閉。完成驗收後刪除伺服器上的 `owner-bootstrap.env`；Secret Store 內密碼仍按正式憑證生命週期管理。

## Storefront 註冊邀請一次性初始化

先從當前 Release 安裝受版本控制的 one-shot unit，再 reload systemd；不得沿用或手寫其他 ExecStart：

```sh
sudo install -m 0644 \
  /opt/zhudatuan/current/02_platform_pingtai/infrastructure/zhudatuan/aliyun/systemd/zhudatuan-registration-bootstrap.service \
  /etc/systemd/system/zhudatuan-registration-bootstrap.service
sudo systemctl daemon-reload
```

建立權限 `0700`、Owner 為 `zhudatuan:zhudatuan` 的 `/opt/zhudatuan/shared/registration-bootstrap`，再從 `registration-bootstrap.env.example` 逐鍵建立權限 `0600` 的 `/opt/zhudatuan/shared/registration-bootstrap.env`。確認 migration、cluster-owner boundary reconciliation 與通知 Worker ready 後執行：

```sh
sudo systemctl start zhudatuan-registration-bootstrap.service
sudo systemctl status --no-pager zhudatuan-registration-bootstrap.service
```

成功輸出只包含 `created`／`existing`、固定 invitation ID、到期時間與受保護輸出路徑，不輸出明文邀請碼。邀請文件只允許寫入 `/opt/zhudatuan/shared/registration-bootstrap/registration-invitation.json`；完成真實註冊後立即作廢／刪除該一次性文件與私密 env。註冊頁必須以真實手機號申請 SMS challenge 並輸入收到的 6 位驗證碼；主登入頁的「短信驗證碼登入」仍保持停用，兩者不得混為一談。

## 公開切換阻斷

`registration-compose.yml` 已鎖定 Docker Registry v2 官方 manifest endpoint 回傳的 `postgres:17-alpine` OCI index digest：`sha256:18cfe3ef5e6815560c98237d6216d1e5119702fb0f3894c8785dd58b8bbe5d73`。本機 Docker daemon 不可用，因此公開 DNS／Caddy 切換前，交付人仍必須在目標 ECS 執行 `docker compose pull postgres`、核對實際 architecture manifest／image RepoDigest，並在該映像上重做空庫 replay；不得只依賴本地 PGlite。

`api.zhudatuan.com` 已有可解析 DNS 與活動 Caddy 分流；部署時仍須現場核對 4321／4322／4323 的精確路由與 Purchase 503 gate，不得以 DNS／TLS 可達代替 E2E 證據，也不得在程式內降級 TLS 或改用不受信任端點繞過。

## 回滾

- Caddy 切換前：停止新的 Registration API、WebBusiness API、Purchase API／Jobs，不影響現有展示站。
- Caddy 切換後：還原切換前 Caddy 備份並 reload，再停止新的 Registration API、WebBusiness API、Purchase API／Jobs。
- Release 與資料 Volume 不自動刪除，保留供核驗；任何刪除需 Owner 另行批准。
