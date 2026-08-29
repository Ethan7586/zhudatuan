# Full staging 逐步準備與驗證手冊

本手冊只適用於隔離的 `full` 預發布環境。固定邊界是：北京地域、正式流量 0%、禁止正式資料、禁止正式 endpoint／Secret／Object Store 復用。操作員每次只執行一個步驟，回傳不含敏感值的結果；驗證通過後才進入下一步。

證據記錄放在主機的 `/opt/zhudatuan-staging-full/shared/evidence/readiness.yml`，權限必須是 `0600`。以 `readiness.evidence.example.yml` 為結構範本；禁止記錄手機號、短信驗證碼、密碼、DSN、Bearer、AccessKey、KMS master key、私鑰或 provider secret。

## 狀態門

| ID  | 負責人            | 完成條件                                                                                                          | 失敗時                                        |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| P00 | 用戶              | 可用 MFA 登入阿里雲，地域為 `cn-beijing`，可看到 CloudSSO／RAM、ECS、VPC、RDS、Tair、短信控制台                   | 停止，不建立資源                              |
| P01 | Codex             | clean candidate 可重建；單元、部署合同、環境驗證、制品 SHA-256 全通過                                             | 修代碼，禁止部署                              |
| P02 | Codex＋Owner 任務 | Owner 全域功能／轉讓的 commit、migration 順序、唯一 Owner 不變式與回歸測試已核對                                  | 不整合、不跑 migration                        |
| P03 | 用戶＋Codex       | 只讀盤點已鎖定候選 `i-2zeewhay0farxq8lucrc` 並永久排除正式機 `i-2zeewhay0farxq8lucrd`；無雲端寫入                  | 保持只讀，禁止登入或沿用正式主機              |
| P04 | 用戶              | 明確批准復用候選 ECS 的隔離／硬化規格、新 RDS／Tair、resource group／VPC 的地域、付費模式、預估成本與硬上限          | 不備份、不修改、不購買資源                    |
| P05 | 用戶              | 逐項取得當次授權：先建立並驗證候選備份，再按批准改名／硬化；另行建立隔離 RDS PostgreSQL、Tair 及 staging 網路資源    | 立即停止；不得把某一步批准擴張到其他寫操作    |
| P06 | Codex＋用戶       | RDS TLS、白名單、刪除保護、備份/PITR/還原與 exact 私網 IP；Tair TLS、ACL、AOF、備份均有證據                       | 不安裝 runtime Secret                         |
| P07 | Codex＋用戶       | 控制面預建 safe `zhudatuanregistrationboundary` 並證明精確暫時 SET edge；role matrix、Secret、TLS、proxy 文件通過檢查 | 不啟服務                                  |
| P08 | 用戶＋Codex       | ECS runtime role 僅有 `dysms:SendSms`；簽名、模板、報備可用；IMDSv2 身份核對完成                                  | 不發短信                                      |
| P09 | Codex             | 固定順序完成 RDS initialization → Migration → boundary reconcile → Staging Owner bootstrap；receipt 與 DB 身份核對成功 | 停止並按 restore 計畫處理                  |
| P10 | Codex             | PostgreSQL proxy、Internal Runtime、Identity API、Identity OTP Jobs、Caddy 通過健康／負向路由；Full Jobs 保持 inactive | 停止本 profile，不碰正式服務               |
| P11 | 用戶＋Codex       | Owner 登入 → 建立綁手機的一次性邀請 → 公網 OTP → 註冊 → Console 登入 → 初始 0 業務權限；邀請重放／跨 scope 均拒絕 | 保留證據，回退候選或修復                      |
| P12 | Codex             | **本候選固定阻斷**：尚無無副作用 FullJobsPreflightMain 與 audited sandbox provider adapters；unit 的 `ExecCondition=/usr/bin/false` 不可移除 | 只可稱「Owner 邀請鏈路通」，不可稱 Full ready |

## 每次交互規則

Codex 發到部署任務的每條操作消息必須包含：當前 ID、唯一操作、預期畫面或輸出、可回傳欄位、禁止回傳欄位、停止條件。用戶只需要回覆「完成」和非敏感名稱／ID；不要貼控制台 cookie、AccessKey、STS token、密碼、短信碼或完整環境文件。

### P00：現在由用戶執行

1. 登入阿里雲控制台並完成 MFA。
2. 切到 `cn-beijing`。
3. 只確認能否打開 CloudSSO／RAM、ECS、VPC、RDS、Tair、短信控制台；不要建立或修改任何東西。
4. 回覆每項「可見／不可見」，以及非敏感的 staging account、resource group、ECS、VPC、vSwitch、ECS RAM role 名稱（知道多少回多少）。

停止條件：帳號疑似正式共用帳號、地域不是北京、看不到 MFA／CloudSSO 身份，或需要建立 AccessKey 才能繼續。

### P01–P02：Codex 並行完成

- 從 clean commit 構建；只用 `prepare-release.mjs` 按 `artifacts.yml` 產生 release commit、archive SHA-256、inventory SHA-256。Archive 上傳到 `/opt/zhudatuan-staging-full/archives/<commit>.tar.gz`，解到 `releases/<commit>`；candidate symlink 驗證完成後才可原子切換 `current`。
- 核對 Owner 任務產出的 commit；不得直接複製未提交工作樹。
- 明確記錄所有 migration 版本及 checksum，重跑必須一致。
- `ownerIntegration.tenantBoundaryTestSha256` 必須綁定 Policy 在 tenant 缺失時 fail closed，以及主打團 global Owner／租戶 Owner 的跨租戶正反樣本；只有角色名稱或單一 happy path 不算通過。
- `ownerIntegration.invitationOwnershipTransferTestSha256` 必須同時綁定應用層與真 PostgreSQL 證據：完成 Owner 轉讓後，新 Owner 可建立並撤銷 operator invitation，舊 Owner 對兩項操作均為 403；Owner 判定必須在同一事務查 `access.zhudatuan_owner_context()`，不得使用固定 Ethan principal／membership、request body 或前端狀態。
- P01、P02 都通過前，P03 只能做只讀盤點。

### P03：只讀盤點

使用 CloudSSO 的一小時 session；不建立 RAM user／AccessKey，不附 `Aliyun*FullAccess`。只讀盤點記錄 account、地域與既有資源摘要。正式機與唯一 staging 候選的權威字段及 canonical 摘要必須寫入 `network.productionEcs*`、`network.stagingCandidateEcs*` 與 `network.existingHostInventorySha256`；任何承載 `*.zhudatuan.com` 正式站點的 ECS 都必須排除，不得查看後再順手修改。

北京兩台 ECS 已精確區分：隔離 staging 候選是 `i-2zeewhay0farxq8lucrc`，位於 `cn-beijing-f`、運行中，當前顯示名「福福網-staging」；正式機是 `i-2zeewhay0farxq8lucrd`，顯示名「福福網全域系統」，正在承載 `accounts.zhudatuan.com`、`console.zhudatuan.com`、`api.zhudatuan.com`，永久禁止觸碰。兩個 ID 只差最後一個字符，任何動作前都必須核對完整 ID，不得只憑名稱、前綴或截斷值選擇實例。

P03 只可繼續盤點候選的磁碟、資源組、VPC/vSwitch、安全組、公網入口、RAM role、規格與當前承載內容；不得登入、快照、備份、改名或執行任何寫操作。盤點記錄必須以 `network.productionEcsInstanceId`／`network.productionEcsCurrentName` 綁定正式機，以 `network.stagingCandidateEcsInstanceId`／`network.stagingCandidateCurrentName`／`network.stagingCandidateTargetName`／`network.stagingCandidateZone` 綁定候選，並把完整 canonical inventory 摘要寫入 `network.existingHostInventorySha256`；後續 P05/P07 的 `network.ecsInstanceId` 必須精確等於 `i-2zeewhay0farxq8lucrc`，IMDSv2 live gate 也必須返回同一完整值。身份鎖定不等於部署授權：初次備份／快照須另取該動作批准；備份完成並驗證後，改名為 Owner 指定的「福福網 staging」、改網路／安全組／RAM role、登入及部署仍各自需要當次批准。

### P04–P06：付費資源及硬化

只有 `STAGING-INFRASTRUCTURE-SPEC-20260829.md` 與填妥的 `staging-cost-approval.example.yml`（北京控制台即時成本資料）得到 Ethan 對**候選復用／硬化規格、新 RDS/Tair 規格與成本硬上限**的明確批准後，才可進入 P05。P04 前不登入主機、不建立備份／快照、不改名／網路／RAM role、不部署，也不建立或訂閱 RDS/Tair；這可避免把成本批准誤當成寫入授權，或由 provision API 的廣域 Resource 造成跨地域誤建。

先把 template 複製成不進 git 的批准文件，另存已脫敏北京報價、批准規格與獨立 Ethan 批准收據三個只讀文件，再執行 `node infrastructure/zhudatuan/aliyun/staging/validate-cost-approval.mjs --file <approved-yaml> --quote-evidence <redacted-quote-file> --specification <spec-file> --approval-receipt <receipt-file>`。驗證器會實際讀取三份 evidence bytes 並重算 YAML 內三個 SHA-256，且拒絕 symlink、可被 group/world 寫入或重複使用的 evidence 文件；同時拒絕 extra key、過期／超過 24 小時的報價、未批准狀態、錯誤 72/730 小時計算、短信／流量 cap 算術及低於 72 小時估算的 hard cap。其輸出的 `costEstimateSha256` 才可填入 P04 evidence。這能證明批准 YAML 綁定指定 bytes，但仍須人工核對報價文件確實源自登入後的北京售賣頁，且不替代 Ethan 在獨立 task 中的明確批准。

- ECS：只復用 `i-2zeewhay0farxq8lucrc`，不得另選其他 ECS。先獲得候選備份／快照的當次批准並驗證可恢復，再逐項批准資源組、專用 VPC/vSwitch、安全組、RAM role、改名、登入及部署；不得承載或匯入任何正式域名／Caddy route。若只讀盤點顯示它無法安全隔離，立即停止並重新審批。
- RDS：PostgreSQL、私網 endpoint、同 VPC、無公網地址、只允許 staging ECS 私網來源；開 TLS、刪除保護、備份/PITR，完成一次還原演練。
- Tair：同 VPC、無公網地址、密碼驗證、TLS、AOF、備份；只允許 staging ECS。
- 當前只確認候選 ECS 身份；尚未授權建立 RDS/Tair，也未授權任何 ECS、網路、RAM 或部署寫操作。P05 的每項批准只覆蓋消息中列出的精確動作。
- 建立後只保留 exact RDS/Tair ARN 的配置權限，撤銷暫時的 provisioner assignment。

### P07：主機私有配置

Internal Runtime env、access policy、catalog、Internal TLS key/cert/CA、RDS CA、proxy env 與全部 workload env 都由 `root:root` 以 `0600` 安裝；shared 目錄為 `root:root 0700`。九個隔離 DynamicUser 只透過 systemd credential/env 載入，不建立或依賴共享 Unix group；Object data directory 由 `StateDirectory=` 管理。五個 DB DSN 都經 `127.0.0.1:55442`，角色分別是 `zhudatuanidentityapi`、`zhudatuanidentityjob`、`shopjob`、`shopmigration`、`zhudatuanbootstrap`；proxy 唯一 upstream 是已登記的 staging RDS 私網 hostname，並用阿里雲 RDS CA 做 SNI／hostname 驗證。

主機工具鏈固定為 Node >=22.22、systemd/systemd-analyze >=252、Caddy >=2.8、PostgreSQL client >=16、OpenSSL >=3；P07 必須用 `systemd-analyze verify` 驗證 9 個候選 unit，並以 `hostConfiguration.hostToolchainSha256` 綁定版本與 unit digest。

Internal Runtime 固定提供：Secret Store `8643`、KMS `8644`、Object Store `8645`。API、Identity SMS Jobs、Full Jobs、Migration、Owner bootstrap 的 Secret/KMS bearer 依需求全部不同，並與 Object bearer 不同；每個 bearer 只可存取 policy 所列精確 ref/key。先用 bootstrap policy/catalog 完成 one-shot，再刪除 one-shot env 與值、切換 runtime policy/catalog並重啟；未完成前不得開公網。Object Store 只寫 `/var/lib/zhudatuan-staging-full/objects`。正式的 `8543/8544`、正式 namespace、正式 DB/Redis/Object Store 均禁止出現。

這是單機 staging 的 local envelope KMS boundary，不是阿里雲託管 KMS，也不是獨立硬體安全域。Internal Runtime 的三個 child process 共享同一個 DynamicUser 與父進程環境，任何一個 child 被完全攻破都應視為本地 master key、catalog 與 Object token 同時失守；只有 Ethan 在 P04 明確接受這項隔離測試風險時才可繼續，正式環境不得沿用。

### P08：短信最小權限

ECS runtime role 僅附以下動作，不建立長期 AccessKey：

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "dysms:SendSms",
      "Resource": "*",
      "Condition": { "Bool": { "acs:SecureTransport": ["true"] } }
    }
  ]
}
```

短信產品不支援把 IAM 權限限制到特定簽名、模板或手機號，因此簽名／模板／報備要另以控制台證據核對。候選 ECS 的既有 RAM role 必須先只讀盤點；備份驗證與當次批准後，也只能增加這個精確 policy，不能直接替換 role。

### P09–P10：啟動順序

1. 安裝候選 Release，但先不切換 `current`。
2. 驗證 archive/inventory SHA-256，再原子切換 staging `current`。
3. 顯式啟動 PostgreSQL TLS proxy，確認只監聽 `127.0.0.1:55442` 且 upstream TLS 驗證成功。
4. 顯式啟動 Internal Runtime，確認只監聽 `127.0.0.1:8643/8644/8645`。
5. 將 P06 控制面登記的 exact RDS 私網 IP 寫入 root-only `rds-init.env`；執行前核對 safe boundary role、pristine DB、snapshot 與唯一暫時 SET edge。初始化的 password/sentinel 不得出現在 argv，任何 guard 失敗都必須證明 role／database owner／schema 零變更。以同一 sentinel、同一實際阿里雲 init authority 連續跑兩次 initialization，確認第一次撤掉 edge 後第二次仍能 exact replay，且最終 boundary membership=0；將脫敏證據綁入 `database.rdsAdminInitReplaySha256`，本機 vanilla superuser fixture 不能替代這一步。再固定執行 Migration → reviewed boundary reconcile → Staging Owner bootstrap → database principal retirement。
6. Retirement 事務必須對 7 個退役角色執行 `NOLOGIN PASSWORD NULL` 並撤銷所有相關 membership；live gate 證明它們 `NOLOGIN`、membership／ACL 為零，password-null 則由原子 SQL 與 digest 收據綁定（`pg_roles.rolpassword` 對非超級使用者固定遮罩，不能作 live 證據）。只有 3 個 runtime 角色可登入，4 個 compatibility/boundary 角色永久 `NOLOGIN`，`shopmigration` 僅保留 inert database ownership。再刪除 `full-migration.env`、`full-owner-bootstrap.env`、`rds-init.env`、`database-retire.env`，切換 runtime catalog/policy；驗證四個 env 均不存在，並以 `database.roleMatrixSha256` 與 `hostConfiguration.runtimeBoundarySha256` 記錄 P09 邊界。
7. P10 顯式 `systemctl start` Identity API 與 Identity OTP Jobs；每條 runtime 啟動鏈都必須重新通過 live DB boundary，不依賴重啟後會消失的一次性 unit active 狀態。
   `registration-only` 在 `bootstrap_pending` 期間同樣禁止對外；DB oracle 必須回報恰好一個 `active` platform Owner，且四個 one-shot env 均不存在，否則 service 不啟動／不 ready。
8. 只在已完成備份驗證並獲得部署當次批准的 `i-2zeewhay0farxq8lucrc` 執行 `install-caddy-candidate.sh --dedicated-staging-host`；腳本先用 IMDSv2 精確綁定 P05 的完整 instance ID，任何返回 `i-2zeewhay0farxq8lucrd` 或其他 ID 的情況立即停止。它只接受發行版原始或本工具管理的 Caddyfile，覆蓋前建立 SHA-256 命名的 root-only 恢復副本。另一步重新核對備份並取得服務操作批准後，才可 `systemctl daemon-reload`、`restart caddy`。P10 核對 active Caddyfile、唯一受控 drop-in、root-only Host env、DNS 與 P05 已核對公網地址 fingerprint；Full Jobs 必須保持 inactive 且不得 enable。
9. 先驗本機健康與 Internal Runtime 權限探針，再驗公網 allowlist；未列出的 API 必須 404。P10 以 `runtime.systemdStateSha256`、`runtime.caddyValidationSha256`、`runtime.dnsResolutionSha256` 與 `runtime.internalAccessProbeSha256` 記錄結果。

任何一項失敗即停止；禁止跳過失敗 gate，禁止用正式資料／正式 endpoint 臨時頂替。

### P11–P12：驗收與命名

P11 由用戶在自己的手機上輸入短信碼，Codex 不索取或記錄驗證碼。證據只保留阿里雲 BizId/request ID 的 SHA-256、送達時間、邀請 ID 的 SHA-256、membership ID 的 SHA-256、拒絕案例及審計事件 ID。

P12 在本候選不可通過。現有資料庫／Redis／catalog／provider 摘要欄位不等於無副作用 live preflight；在 `FullJobsPreflightMain`、精確 sandbox endpoint/account allowlist、禁止 AccessKey/default credential chain，以及 provider 負向網路證據完成審查前，`zhudatuan-staging-full-jobs.service` 由 `ExecCondition=/usr/bin/false` 固定阻斷。不得 start／enable，也不得用任意 64 位摘要解除。

本候選不能標記 `full-ready`。若 P11 通過，對外結論只能寫成「隔離公網 Owner 邀請／短信鏈路已通」，不能寫成「整個主打團後台已部署完成」。

## 驗證命令

```bash
node services/commerce/dist/StagingReadinessMain.js \
  --evidence /opt/zhudatuan-staging-full/shared/evidence/readiness.yml \
  --check P00 --json

node services/commerce/dist/StagingReadinessMain.js \
  --evidence /opt/zhudatuan-staging-full/shared/evidence/readiness.yml \
  --all --json
```

P00–P06、P08–P09、P11–P12 包含控制台／provider／人工證據，必須由 Codex 對照原始只讀畫面或 API 結果核實；YAML 本身不是可信來源。P07 與 P10 除證據欄位外，驗證器還會強制讀取固定的 `/opt/zhudatuan-staging-full` 實際文件、owner/mode、catalog 關係、listener、systemd、Caddy 及公網負向路由。Full profile 禁止 PM2。驗證器只輸出 gate、狀態與非敏感 fingerprint，不輸出原始配置或 Secret。退出碼非 0 代表不可進入下一步。
