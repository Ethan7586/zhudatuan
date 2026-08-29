# 隔離公網預發布 Profiles

此目錄提供兩個必須顯式選擇、不能混用的 staging profile：

- `identity-sms`：可選的最小身份／短信 profile，運行 `IdentityRegistrationApiMain` 與 `IdentityNotificationJobsOnlyMain`，不用 Redis。
- `full`：Owner 已批准的目標 profile，運行同一個最小公網身份 API，並以 `JOB_RUNTIME_PROFILE=full` 從 `JobsMain.js` 進入已 bundle 的最新 `FullJobsMain.ts`。

沒有通用 `ecosystem.config.cjs` 或 `Caddyfile`，因此操作員必須在命令中寫出 profile。兩個 profile 使用不同 Release／shared／log 路徑、不同進程名、不同 Host 變量及不同 API port，不能靠父進程環境偷偷切換。

目前 `full` 是 `gated-not-yet-verified` 的 fail-closed 合同，授權狀態為 `readiness-gates-required`。獨立 RDS、Redis、Secret Catalog、KMS、完整 Provider 配置、DNS／TLS 與 Edge Access 的實際證據未完成前，不得跨 gate 啟動、不得稱為已接通。逐項操作、停止條件與證據格式見 `PREPARE.md` 及 `readiness.evidence.example.yml`。

已鎖定的唯一 staging ECS 候選是北京 F 區、運行中的 `i-2zeewhay0farxq8lucrc`，控制台當前顯示名「福福网-staging」，Owner 指定的最終顯示名「福福网 staging」。正式 ECS `i-2zeewhay0farxq8lucrd`（「福福网全域系统」）正在承載 `accounts.zhudatuan.com`、`console.zhudatuan.com`、`api.zhudatuan.com`，永久禁止觸碰。兩個 ID 只差最後一個字符；任何動作前必須核對完整 ID。候選身份已確認不等於批准備份、登入、改名、改網路／RAM role 或部署；初次備份／快照及後續每項寫操作都須遵循 P03–P05 的獨立批准門禁。

## 公網路由邊界

兩個 profile 都只把身份 API 的精確 method/path 放到公網。Owner 邀請新增路由如下：

- `POST /api/v1/identity/invitations`
- `DELETE /api/v1/identity/invitations/{id}`，Caddy 以 `^/api/v1/identity/invitations/[^/]+$` 限制為單一 ID segment，禁止 `*` wildcard。
- 對應的精確 `OPTIONS` preflight。

這只是邊緣放行；API 內仍必須通過 authenticated operator policy、權限、scope、step-up／風險及審計合同。Caddy 不提供任何身份繞過。其餘註冊、登入、session 路由保持既有 allowlist，未命中的請求一律 404。

## Profile 隔離

| 合同       | `identity-sms`                        | `full`                                                                      |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Release    | `/opt/zhudatuan-staging/current`      | `/opt/zhudatuan-staging-full/current`                                       |
| Shared     | `/opt/zhudatuan-staging/shared`       | `/opt/zhudatuan-staging-full/shared`                                        |
| API port   | `127.0.0.1:4421`                      | `127.0.0.1:4431`                                                            |
| Jobs entry | `IdentityNotificationJobsOnlyMain.js` | `JobsMain.js` → bundled `FullJobsMain.ts`                                   |
| Redis      | 禁止／不用                            | 獨立 staging Redis，必需                                                    |
| Caddy      | `Caddyfile.identity-sms`              | `Caddyfile.full`                                                            |
| 進程管理   | PM2：`ecosystem.identity-sms.config.cjs` | systemd-only：9 個 `zhudatuan-staging-full-*.service` unit                  |
| PM2 guard  | 不適用                                | `ecosystem.full.config.cjs` 只會 fail closed，禁止作為部署制品              |
| 內部服務   | 不適用                                | systemd：PG TLS proxy 55442、Secret Store 8643、KMS 8644、Object Store 8645 |

兩者都不得引用 `/opt/zhudatuan/current`、正式域名、正式資料庫、正式 Redis、正式 Object Store 或正式 Secret namespace。

## Full 外部資源前置條件

在 Full 的 readiness gates 授權啟動前，必須把以下證據放進受控 Release 記錄，而不是只提供口頭名稱；不要手改靜態 YAML 來假裝已通過：

1. 只復用已鎖定的 `i-2zeewhay0farxq8lucrc`，不得另選或建立其他 ECS。P03 先只讀盤點其磁碟、資源組、VPC/vSwitch、安全組、公網入口、RAM role 與承載內容；P04 批准拓撲／成本後，仍須先為備份／快照取得當次批准並驗證可恢復，再逐項批准改名、網路／RAM role、登入和部署。`network.stagingCandidateEcsInstanceId` 與 P05 的 `network.ecsInstanceId` 必須都精確等於該完整 ID；正式機 `i-2zeewhay0farxq8lucrd` 永久拒絕。
2. 隔離 RDS PostgreSQL 的私網 endpoint、database identity、snapshot、PITR 與還原演練證據。
3. DB 角色矩陣固定為：3 個 runtime LOGIN（`zhudatuanidentityapi`、`zhudatuanidentityjob`、`shopjob`）、7 個初始化後必須退役的歷史／一次性 LOGIN（`shopapp`、`shopmigration`、`shopread`、`zhudatuanbootstrap`、`zhudatuanwebapi`、`zhudatuanpurchaseapi`、`zhudatuansandboxbootstrap`），以及 4 個永久 `NOLOGIN` boundary role（`anon`、`authenticated`、`service_role`、`zhudatuanregistrationboundary`）。Retirement 事務必須對所有退役角色執行 `NOLOGIN PASSWORD NULL` 並撤銷 membership；live gate 以 `NOLOGIN`、membership／ACL 為零及 SQL digest 收據證明邊界，因 PostgreSQL 的 `pg_roles.rolpassword` 對非超級使用者固定遮罩，不能拿它作 password-null 證據。`shopmigration` 只保留不可登入的 database ownership。
4. 獨立 staging Redis 或等價 VPC／ACL 硬邊界，`zhudatuan-staging/full/redis/jobs` 絕不能解析到正式 Redis。
5. 一套只屬於 full staging 的 Internal Runtime：Secret Store 固定 `127.0.0.1:8643`、KMS 固定 `127.0.0.1:8644`，catalog、KMS master key 及 Bearer 都不得復用正式驗收環境。`full-internal-access.json` 為每個 workload 分配獨立 bearer 與精確 Secret ref／KMS key allowlist；未知 token、越權 ref、萬用字元全部 fail closed。bootstrap 與 runtime policy 分階段安裝，公網啟動前必須退役 Migration／Owner login、password、membership 並移除一次性 Secret。
6. `WECHAT_APPLICATION_CONFIG_REF`、`WECHAT_PAYMENT_CONFIG_REF`、`INVOICE_CONFIG_REF`、`PAYOUT_CONFIG_REF`、`NOTIFICATION_CONFIG_REF`、`EXTENSION_MANIFEST_KEY_REF` 全套 sandbox 配置；Object Store 由本 profile 的 loopback Internal Runtime 提供，token 經 `OBJECT_STORE_TOKEN_REF` 讀取。
7. 阿里雲短信簽名、驗證模板、運營商報備與 ECS RAM Role；不得在 env 或 Secret JSON 保存長期 AccessKey。

`registration-only` 只是縮小 API 路由面，不代表可以在 Owner `bootstrap_pending` 時對外。Identity API、Identity OTP Jobs 與 Full Jobs 每次啟動都必須透過 DB oracle 證明恰好一個 `active` platform Owner；0 個、2 個或仍有任何 one-shot credential env 時均 fail closed。systemd 的 Owner bootstrap／principal retirement 排序是附加防線，重啟後仍以持久資料庫狀態為準。
8. Full 三個獨立 Host、TLS 與 Edge Access policy；production traffic 固定為 0。

`NOTIFICATION_CONFIG_REF` 不是 identity-only 的 `IDENTITY_NOTIFICATION_CONFIG_REF`。Full secret 必須是 runtime 要求的 `sms`、`email`、`wechat` 三段完整 JSON；其中短信使用已審批 staging 簽名／模板與 RAM Role。缺任一 ref、Bearer、Redis 或 provider configuration，官方 env validator／runtime constructor 都會拒絕啟動。

## RDS 與 loopback proxy 合同

Runtime 的三個資料庫 Secret 與 Owner bootstrap DSN 都必須指向 `127.0.0.1:55442`；該 listener 的唯一 upstream 是隔離 staging RDS 私網 endpoint。連線後身份分別為：

- API：`zhudatuanidentityapi`
- Identity SMS Jobs：`zhudatuanidentityjob`
- Full Jobs：`shopjob`
- Migration：`shopmigration`

`BootstrapStagingOwner` 有 staging 專用的安全邊界：只接受 `zhudatuanbootstrap@127.0.0.1:55442/zhudatuan_registration`，Secret Store 只接受 `https://127.0.0.1:8643`。因此執行此一次性制品前必須先建立：

- Release 內的 `PostgresTlsProxyMain.js` 僅綁定 `127.0.0.1:55442`；它先送 PostgreSQL SSLRequest，拒絕不支援 TLS 的 upstream，再以 RDS hostname 做 SNI 與 CA/hostname 驗證。
- 由本 profile 的 `InternalRuntimeMain.js` 在 `127.0.0.1:8643` 提供獨立 Secret Store；不得把既有正式驗收的 `8543`／`8544` 映射或轉發給 staging。
- Secret Store 還必須提供獨立、至少 32 字元的高熵 bootstrap receipt；它只用於重跑一致性，不得由 Owner 密碼派生，且 reference 不得與 identity key／Owner password 相同。

禁止把任何正式 endpoint 映射到上述 loopback listener。安全組只允許 staging workload 主機到 staging RDS／Redis，RDS 不開公網。啟動前由 root-only systemd one-shot 讀取 EnvironmentFile，並把查詢經 `psql` stdin 執行；connection password 只由 libpq environment 讀取，其餘 password 與 sentinel 只以 psql `\getenv` 匯入，不得放入命令列、shell history 或日誌。`ZHUDATUAN_EXPECTED_RDS_SERVER_ADDR` 必須是 P06 從阿里雲控制面登記的單一 RDS 私網 IP，不能填 proxy loopback、DNS 或查詢結果自我背書。初始化 guard 在任何 DDL 前同時核對 PostgreSQL 16、database、owner、非 recovery、該私網 IP、pristine／既有 sentinel 狀態，以及預建 inert boundary role 的實際 `SET ROLE` 能力。

P07 必須先由阿里雲 RDS 控制面／系統授權路徑預建普通帳號 `zhudatuanregistrationboundary`，再以 reviewed 管理 session 收斂成 `NOLOGIN PASSWORD NULL NOINHERIT`；不得把 vanilla PG16 superuser fixture 當成阿里雲 `pg_rds_superuser` 的等價證據。執行 init 前，catalog 中只允許一條**暫時**的 boundary → init authority membership：grantor 必須是同一 init authority、`SET=true`、`INHERIT=false`，不得有其他 member／grantor edge；先以 `BEGIN; SET LOCAL ROLE zhudatuanregistrationboundary; RESET ROLE; ROLLBACK;` 證明能力。init transaction 會撤除此 edge，完成後必須為零 membership。若阿里雲控制面無法安全形成這條精確暫時 edge，或實際 `pg_rds_superuser` 無法在 edge 清除後以相同 sentinel 精確重跑，立即停止，不得以 superuser fixture 代替。

## Migration 與 Staging Owner 制品清單

完整清單在 `artifacts.yml`，一次性執行順序固定：

1. `infrastructure/zhudatuan/aliyun/postgres-init-registration.sh`，由 `zhudatuan-staging-full-rds-init.service` 執行。
2. `services/commerce/dist/MigrationMain.js`，由 `zhudatuan-staging-full-migration.service` 執行。
3. `infrastructure/zhudatuan/aliyun/postgres-reconcile-registration-boundary.sql`，以 reviewed stdin 執行。
4. `services/commerce/dist/BootstrapStagingOwner.js`，由 `zhudatuan-staging-full-owner-bootstrap.service` 執行。
5. `infrastructure/zhudatuan/aliyun/postgres-retire-registration-bootstrap.sql`，由 `zhudatuan-staging-full-database-retire.service` 執行。

Full 使用通用 `MigrationMain.js`；`RegistrationMigrationMain.js` 釘死非 staging path/ref，因此明確排除。倉庫也不會產生獨立 `FullJobsMain.js`：`FullJobsMain.ts` 由 `JobsMain.js` bundle，Release 驗證必須同時確認 bundle 內有 `JOB_RUNTIME_CATALOG_DRIFT` marker。

RDS initialization 之前必須有可還原 snapshot。首次執行只接受 owner 為當前 bootstrap admin、除 `public` 外沒有 user schema、`public` 無 relation/function、未安裝非 `plpgsql` extension，且 13 個 application／compatibility role 全不存在的 pristine database；任一殘留都在第一個 DDL 前拒絕。重放只接受 database owner=`shopmigration`、13 個角色／membership／object owner 完全符合 init phase，且 `deployment.boundary` 唯一 row 的 sentinel hash 精確相同；腳本只用 `ON CONFLICT DO NOTHING`，絕不更新錯誤 sentinel。所有可行 role、database owner、schema、table、function DDL 與 membership cleanup 位於同一個 psql transaction；任一步失敗全部回滾。Migration 前必須成功建立完整 role matrix 與 registration boundary，Staging Owner bootstrap 前必須完成 boundary reconciliation。公開邀請改由通過 authenticated operator policy 的 invitation create／revoke API 執行，`BootstrapRegistration.js` 在本 profile 明確禁止。

## 準備 Full Runtime 文件

先建立隔離目錄，再把 example 複製到主機外部。所有 `.invalid`、`replace-*`、`REPLACE_*` 都是刻意保留的 blocker；未替換不得啟動。

```bash
install -d -o root -g root -m 0755 /opt/zhudatuan-staging-full /opt/zhudatuan-staging-full/releases
install -d -o root -g root -m 0700 /opt/zhudatuan-staging-full/shared /opt/zhudatuan-staging-full/shared/tls /opt/zhudatuan-staging-full/shared/evidence
install -d -o root -g root -m 0700 /run/zhudatuan-staging-full
install_new_root_secret() {
  local source="$1" target="$2"
  if [[ -e "$target" || -L "$target" ]]; then
    printf 'refusing to overwrite existing secret: %s\n' "$target" >&2
    return 1
  fi
  install -o root -g root -m 0600 -- "$source" "$target"
}
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-identity-registration-api.env.example /opt/zhudatuan-staging-full/shared/full-identity-registration-api.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-identity-notification-jobs.env.example /opt/zhudatuan-staging-full/shared/full-identity-notification-jobs.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-jobs.env.example /opt/zhudatuan-staging-full/shared/full-jobs.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-internal-runtime.env.example /opt/zhudatuan-staging-full/shared/full-internal-runtime.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-migration.env.example /opt/zhudatuan-staging-full/shared/full-migration.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-owner-bootstrap.env.example /opt/zhudatuan-staging-full/shared/full-owner-bootstrap.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-postgres-proxy.env.example /opt/zhudatuan-staging-full/shared/full-postgres-proxy.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-caddy.env.example /opt/zhudatuan-staging-full/shared/full-caddy.env
# 只複製專用鍵名結構；在主機內替換全部 blocker，不得把填值後文件帶回倉庫。
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-rds-init.env.example /run/zhudatuan-staging-full/rds-init.env
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/full-database-retire.env.example /run/zhudatuan-staging-full/database-retire.env
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-identity-api.service /etc/systemd/system/zhudatuan-staging-full-identity-api.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-identity-notification-jobs.service /etc/systemd/system/zhudatuan-staging-full-identity-notification-jobs.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-database-retire.service /etc/systemd/system/zhudatuan-staging-full-database-retire.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-internal-runtime.service /etc/systemd/system/zhudatuan-staging-full-internal-runtime.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-jobs.service /etc/systemd/system/zhudatuan-staging-full-jobs.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-migration.service /etc/systemd/system/zhudatuan-staging-full-migration.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-owner-bootstrap.service /etc/systemd/system/zhudatuan-staging-full-owner-bootstrap.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-postgres-proxy.service /etc/systemd/system/zhudatuan-staging-full-postgres-proxy.service
install -m 0644 infrastructure/zhudatuan/aliyun/staging/zhudatuan-staging-full-rds-init.service /etc/systemd/system/zhudatuan-staging-full-rds-init.service
install_new_root_secret infrastructure/zhudatuan/aliyun/staging/readiness.evidence.example.yml /opt/zhudatuan-staging-full/shared/evidence/readiness.yml
unset -f install_new_root_secret
```

上述函數刻意拒絕重跑覆蓋；密鑰輪換必須先另建 `root:root 0600` 臨時文件、獨立核對內容，再以同目錄原子 rename 完成，不得重新複製 example 或把 placeholder 蓋回有效憑據。

候選 release 目錄、其中非敏感程式與 `current` symlink 固定為 `root:root`；目錄為 `0755`、普通制品為 `0644`，讓 DynamicUser 只能 traverse／read，不能取得 `zhudatuan` supplementary group。`current` 只可原子指向已核對 SHA-256 的 `/opt/zhudatuan-staging-full/releases/<release>`。

所有 Full credential source 都由 `root:root` 以 `0600` 安裝：Internal Runtime env、proxy env、`full-secrets.json`、`full-internal-access.json`、Internal TLS private key/certificate/CA 及 RDS CA。shared／tls／evidence 目錄固定 `root:root 0700`；九個 DynamicUser unit 只透過 systemd `EnvironmentFile=`／`LoadCredential=` 取得各自所需內容，不建立或依賴 `zhudatuan` group。內部 CA 與 server certificate/key 由 root 執行 `node infrastructure/zhudatuan/aliyun/staging/prepare-internal-tls.mjs` 產生，僅記錄 certificate SHA-256。`/run/zhudatuan-staging-full/rds-init.env` 與 `database-retire.env` 同樣由 root 臨時建立為 `0600`。Readiness evidence 固定 `root:root 0600`。Object data directory 交由 Internal Runtime unit 的 `StateDirectory=` 建立與管理；不得手動建共享狀態目錄，不得建立 `PM2_HOME` 或 Full PM2 進程。

先用 `.bootstrap.example.json` 的結構執行 RDS initialization／Migration／Owner bootstrap；完成後刪除一次性 env，改用不含 Migration DSN、Owner password／receipt 的 runtime `full-secrets.example.json` 與 `full-internal-access.example.json`，重啟 Internal Runtime 後才可啟動公網 API。安裝後必須以 `namei -l` 核對路徑，以記憶體摘要比對所有 bearer 互異，並確認 catalog 的 `zhudatuan/staging/full/objects/jobs` 與 `LOCAL_OBJECTS_TOKEN` 相同；驗證輸出不得包含任何值。`LOCAL_RUNTIME_PROFILE=full-staging` 會啟動 bundled Secret Store／KMS／Object Store。

## 構建同一候選版本

以下 Host 必須是隔離 Full Host；Auth／Console 的 API Origin 必須與 Caddy profile 一致：

2026-08-29 的只讀審計顯示品牌 staging DNS 仍未就緒。只有候選 `i-2zeewhay0farxq8lucrc` 完成只讀盤點、備份驗證及 P05 當次網路／部署批准，並由 IMDSv2 核對完整 ID 後，才可用其已批准的 staging 公網 IPv4 產生三個臨時 `sslip.io` Host；禁止填入正式 ECS `i-2zeewhay0farxq8lucrd` 的地址。三個 Host 必須只解析到同一個已核對地址，P10 會把解析結果與 P05 的 `network.publicAddressFingerprint` 比對。這只是臨時解析，不是品牌 staging DNS；Caddy ACME／HTTPS 成功前不得開始公網驗收。

```bash
staging_public_ipv4='<P05 核對的 i-2zeewhay0farxq8lucrc staging 公網 IPv4>'
[[ "$staging_public_ipv4" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || exit 1
staging_sslip_label="${staging_public_ipv4//./-}"
export ZHUDATUAN_STAGING_FULL_ACCOUNTS_HOST="accounts.staging.${staging_sslip_label}.sslip.io"
export ZHUDATUAN_STAGING_FULL_CONSOLE_HOST="console.staging.${staging_sslip_label}.sslip.io"
export ZHUDATUAN_STAGING_FULL_API_HOST="api.staging.${staging_sslip_label}.sslip.io"
```

把相同三個值寫入 root-only `full-caddy.env`。P01 只能從 clean commit 用受控腳本組包；`prepare-release.mjs` 會自行依次執行 Auth、Console、Commerce 三個 build，再按 `artifacts.yml` 複製制品並生成 manifest、inventory SHA-256 與 tar archive SHA-256。不得先用另一組 Host 手動 build；dirty worktree、既存輸出路徑或 Host 不一致都會 fail closed：

```bash
release_commit="$(git rev-parse HEAD)"
release_stage_root="$(mktemp -d)"
node infrastructure/zhudatuan/aliyun/staging/prepare-release.mjs \
  --output "${release_stage_root}/release" \
  --archive "${release_stage_root}/${release_commit}.tar.gz"
```

只把該 archive 上傳到隔離 staging 主機；主機端先放入 immutable archive 路徑、解到同 commit release，再建立 candidate symlink。以下 `staging_archive_source` 必須指向剛上傳且已比對腳本輸出摘要的檔案：

```bash
install -d -o root -g root -m 0755 /opt/zhudatuan-staging-full/archives /opt/zhudatuan-staging-full/releases
test ! -e "/opt/zhudatuan-staging-full/archives/${release_commit}.tar.gz" && test ! -L "/opt/zhudatuan-staging-full/archives/${release_commit}.tar.gz"
install -o root -g root -m 0444 "${staging_archive_source}" "/opt/zhudatuan-staging-full/archives/${release_commit}.tar.gz"
printf '%s  %s\n' "${expected_archive_sha256}" "/opt/zhudatuan-staging-full/archives/${release_commit}.tar.gz" | sha256sum --check -
test ! -e "/opt/zhudatuan-staging-full/releases/${release_commit}" && test ! -L "/opt/zhudatuan-staging-full/releases/${release_commit}"
install -d -o root -g root -m 0755 "/opt/zhudatuan-staging-full/releases/${release_commit}"
tar --extract --gzip --file "/opt/zhudatuan-staging-full/archives/${release_commit}.tar.gz" \
  --directory "/opt/zhudatuan-staging-full/releases/${release_commit}" --no-same-owner
test ! -e /opt/zhudatuan-staging-full/candidate && test ! -L /opt/zhudatuan-staging-full/candidate
ln -s "releases/${release_commit}" /opt/zhudatuan-staging-full/candidate
(cd /opt/zhudatuan-staging-full/candidate && sha256sum --check .zhudatuan-staging-inventory.sha256)
jq -e --arg commit "${release_commit}" '.commit == $commit and .treeState == "clean"' \
  /opt/zhudatuan-staging-full/candidate/.zhudatuan-staging-release.json
```

Candidate 的 inventory、manifest、Caddy／systemd 靜態驗證及 P01 evidence 全部通過後，才可原子切換；不可直接解壓到 `current`：

```bash
mv -T /opt/zhudatuan-staging-full/candidate /opt/zhudatuan-staging-full/current
```

切換前 P01 驗證 `candidate`；切換後最終 `--all` 改驗證同一 commit 的 `current`，並再次比對 manifest、逐檔 inventory 與保留的 archive。P10 另會把 `current` manifest 綁到 evidence 中的 commit，避免 runtime 與 P01 證據脫節。

清單中的 `inventory-only-not-provisioning-evidence` 不代表任何雲資源已存在。

## 驗證與啟動

先執行 repository check 與官方 env validators。Caddy 候選會由受控 installer 使用 root-only Host env 做原生驗證；不要用未填值 example 假裝已驗：

```bash
node infrastructure/zhudatuan/aliyun/staging/check.mjs
node scripts/audit/postgres-init-registration.pg16-fixture.mjs local-disposable-fixture
npx tsx infrastructure/zhudatuan/aliyun/staging/validate-environments.ts
```

PG16 fixture 只建立帶唯一名稱的本機 Docker network／server／client，依序驗證 wrong address、nonempty DB、正向 init、wrong sentinel 與 exact replay，並在 `finally` 移除容器、network 與 root-only 臨時 env；不得把確認參數改造成任意外部 URL。

上述本機 fixture 驗證 SQL 交易性與錯目標零變更，但容器正向路徑使用 vanilla `postgres` superuser，不能證明阿里雲 RDS 的 pseudo-superuser 語義。P09 必須在新、已批准的 staging RDS 上以實際 init authority 連續成功執行兩次同 sentinel 初始化，第二次只能是 exact replay；把脫敏 transcript、當前 authority/DB/私網 peer、前後 role matrix 與最終 boundary membership=0 的 canonical SHA-256 寫入 `database.rdsAdminInitReplaySha256`。任何一步不成立，P09 不得 verified。

P07 只可在已完成備份驗證並獲得主機登入當次批准的 `i-2zeewhay0farxq8lucrc` 上核對 `/usr/bin/node >= 22.22`、`systemd/systemd-analyze >= 252`、Caddy >= 2.8、PostgreSQL client tools >= 16、OpenSSL >= 3，並對候選的 9 個 unit 執行 `systemd-analyze verify`。版本與 unit digest 共同寫入 `hostConfiguration.hostToolchainSha256`；IMDSv2 ID 不一致或版本不滿足即停止。

所有檔案與外部前置證據備妥後，先顯式啟動 PostgreSQL TLS proxy 與 staging 專用 Internal Runtime。Full 的九個 unit 均由 systemd 擁有，不得用 PM2 啟動：

```bash
systemctl daemon-reload
systemctl enable --now zhudatuan-staging-full-postgres-proxy.service
systemctl is-active zhudatuan-staging-full-postgres-proxy.service
systemctl enable --now zhudatuan-staging-full-internal-runtime.service
systemctl is-active zhudatuan-staging-full-internal-runtime.service
ss -lnt | grep -E '127\.0\.0\.1:(55442|8643|8644|8645)'
```

Internal Runtime 可用後，P09 固定執行以下一次性順序；兩個 RDS 管理 env 必須由 root 置於 `/run/zhudatuan-staging-full` 且為 `0600`，成功後立即刪除：

```bash
systemctl start zhudatuan-staging-full-rds-init.service
systemctl start zhudatuan-staging-full-migration.service
# 經審閱後，以 staging RDS bootstrap session 將 postgres-reconcile-registration-boundary.sql 送入 psql stdin。
systemctl start zhudatuan-staging-full-owner-bootstrap.service
systemctl start zhudatuan-staging-full-database-retire.service
```

五步 receipt／資料庫身份都通過後，retirement 事務必須已對 7 個退役角色執行 `NOLOGIN PASSWORD NULL`、撤掉所有與它們相連的 membership，並只保留 inert `shopmigration` database ownership。Live gate 驗證 7 個角色均不可登入且 membership／ACL 為零；password-null 由原子 retirement SQL 與其 digest 收據綁定，不讀取遮罩後的 `pg_roles.rolpassword`。之後移除 one-shot env、切到 runtime catalog/policy，重啟 Internal Runtime。一次性 unit 的 `active/exited` 狀態不作為重啟後證據；API／Jobs 每次啟動都會重新查詢持久 DB boundary。P10 才顯式啟動 Identity API、Identity OTP Jobs 與 Caddy；Full Jobs 此時必須 inactive：

```bash
rm -- /opt/zhudatuan-staging-full/shared/full-migration.env \
  /opt/zhudatuan-staging-full/shared/full-owner-bootstrap.env \
  /run/zhudatuan-staging-full/rds-init.env \
  /run/zhudatuan-staging-full/database-retire.env
systemctl restart zhudatuan-staging-full-internal-runtime.service
systemctl start zhudatuan-staging-full-identity-api.service
systemctl start zhudatuan-staging-full-identity-notification-jobs.service
systemctl is-active zhudatuan-staging-full-identity-api.service zhudatuan-staging-full-identity-notification-jobs.service
test "$(systemctl is-active zhudatuan-staging-full-jobs.service || true)" = inactive
/opt/zhudatuan-staging-full/current/infrastructure/zhudatuan/aliyun/staging/install-caddy-candidate.sh --dedicated-staging-host
systemctl daemon-reload
systemctl restart caddy.service
systemctl is-active caddy.service
curl --fail --silent http://127.0.0.1:4431/health/ready
```

Installer 只在已完成備份驗證且取得部署當次批准的 `i-2zeewhay0farxq8lucrc` 上使用：它以 IMDSv2 精確比對批准的完整 instance ID、`cn-beijing-f`、VPC/vSwitch/public IP，並硬拒正式機 `i-2zeewhay0farxq8lucrd`、其他 Host、`import`、symlink、非 distro Caddy unit、額外 drop-in，以及任何既非發行版原始配置也非本工具管理版本的 active Caddyfile。覆蓋前先把 active Caddyfile／既有受控 drop-in 依 SHA-256 存入 root-only `shared/caddy-backups`，再原子安裝候選；它本身不 daemon-reload、reload、restart 或切流量。P10 會再次核對 active Caddyfile、drop-in、root-only `full-caddy.env`、systemd effective properties 與候選 Release 完全一致，且 `NeedDaemonReload=no`。

P11 Owner 邀請／短信 E2E 通過後，本候選仍**不得啟動 Full Jobs**。目前缺少無副作用的 `FullJobsPreflightMain` 與 audited sandbox provider adapters；unit 以 `ExecCondition=/usr/bin/false` 固定 fail closed，且沒有 `[Install]`。任意手填的 `providerSandboxSha256` 或其他 64 位摘要都不能解除此阻斷。完成獨立設計、測試與批准前，驗收結論最多是「Owner 公網邀請＋短信鏈路通」，不可稱 Full ready。

`JobsMain` 沒有假的 HTTP readiness port；systemd active 只表示 process 未退出。最終驗收還必須取得 scheduler/outbox、測試短信 BizId、operator invitation create/revoke E2E 與 `fullJobs.systemdStateSha256` 證據。

回退時只停止選中的 staging 進程、恢復同一 profile 的上一個已驗證 Release，並按 snapshot／PITR 計畫處理隔離資料庫；不切正式流量、不修改正式資料。
