# 主打團隔離公網 Staging 基礎設施規格

狀態：**待 Ethan 核對與明確批准；本文件不授權建立或修改任何雲資源。**

版本日期：2026-08-29　地域：華北 2（北京）`cn-beijing`

## 已確認現狀

- 北京 RDS PostgreSQL：0 個實例。
- 北京 Tair：0 個實例。
- KMS 目前只確認產品總覽可見，未確認實例、密鑰或憑據已配置。
- 正式 ECS `i-2zeewhay0farxq8lucrd`（顯示名「福福網全域系統」）正在承載 `accounts.zhudatuan.com`、`console.zhudatuan.com`、`api.zhudatuan.com`，永久排除出 staging；不得登入、快照、安裝、上傳、改名、改 RAM role／網路／安全組或 Caddy。
- 隔離 staging 候選已精確鎖定為 ECS `i-2zeewhay0farxq8lucrc`，位於 `cn-beijing-f`、運行中，控制台當前顯示名為「福福網-staging」；Owner 指定的最終顯示名為「福福網 staging」。這只確認目標身份，不授權備份、登入、快照、改名、改網路／RAM role 或部署。P03 仍須完成磁碟、網路、公網入口、RAM role 與當前承載內容的只讀盤點；初次備份／快照須先取得該動作的明確批准，完成並驗證備份後，其餘每項寫操作仍須取得當次批准。
- 兩個實例 ID 只有最後一個字符不同：staging 為 `...lucrc`，正式為 `...lucrd`。任何控制台或主機動作前都必須核對完整 ID；不能以顯示名、前綴或肉眼省略值選擇目標。
- RAM 角色 `zhudatuan-identity-notification` 只確認列表可見；尚未審閱有效策略，不能推定可用或可修改。

## 隔離拓撲

```text
Internet :80/:443
        │
已鎖定 staging ECS `i-2zeewhay0farxq8lucrc`（通過門禁後作唯一公網入口；Caddy）
        ├─ 127.0.0.1:4431  Identity API
        ├─ 127.0.0.1:55442 PostgreSQL TLS proxy ── private TLS ── 新 RDS
        ├─ 127.0.0.1:8643  staging Secret Store
        ├─ 127.0.0.1:8644  staging KMS boundary
        ├─ 127.0.0.1:8645  staging Object Store
        └─ private TLS ───────────────────────────── 新 Tair
```

本次只可復用已鎖定的 `i-2zeewhay0farxq8lucrc`，不得另選或建立其他 ECS。候選 ECS 的既有資源組、VPC／vSwitch、安全組、RAM role 與磁碟必須先只讀盤點；在備份完成並驗證、P04 成本／拓撲批准及每項寫操作獲得當次授權後，才可把它收斂到專用 staging 邊界。RDS 與 Tair 仍須新建為隔離資源，不與正式 VPC 做對等連接，不使用正式私網 endpoint、Secret namespace、資料、備份或 Caddy route；目前沒有建立或修改它們的授權。若候選 ECS 無法在不接觸正式系統的前提下滿足專用 VPC／vSwitch 邊界，立即停止並重新審批，不得擅自改正式網路或建立其他 ECS。

## 建議資源

| 資源 | 建議配置 | 強制安全邊界 |
| --- | --- | --- |
| Resource Group | 建議 `zhudatuan-staging-isolated`；先只讀核對候選現況 | 通過備份驗證及當次批准後才可變更歸屬；只含候選 ECS、新 RDS、Tair 及其 staging 網路資源 |
| VPC / vSwitch | 專用 staging VPC；建議 `10.68.0.0/16`、單 vSwitch `10.68.1.0/24`，建立或改動前先只讀確認候選現況與 CIDR 不重疊 | 不接正式 VPC；候選 ECS、RDS、Tair 最終位於同一批准的 staging 私網邊界；任何遷移或網路修改須單獨授權 |
| ECS | 復用 `i-2zeewhay0farxq8lucrc`；只讀盤點現有規格後，以 4 vCPU / 8 GiB、40 GiB ESSD、單一 staging 公網 IPv4、按使用流量計費、5 Mbps 峰值作驗收基線 | `network.ecsInstanceId` 必須精確等於完整候選 ID；備份驗證前不得登入或部署；RAM role、規格、公網與安全組的每項變更均須當次批准；22 只允許受控來源或使用 Workbench；80/443 公網；RDS/Tair 僅私網；禁止任何正式域名 |
| RDS PostgreSQL | PostgreSQL 16、基礎系列、建議 2 vCPU / 4 GiB、50 GiB ESSD、按量付費 | 無公網 endpoint；TLS；只允許 staging ECS；登記 exact 私網 IP；刪除保護；每日備份、PITR；Migration 前完成一次還原演練；控制面預建 inert boundary role |
| Tair / Redis | Redis 開源版 7.x、標準主從、1 GiB、按量付費 | 無公網 endpoint；TLS、密碼、AOF、備份；只允許 staging ECS |
| Secret Store / local envelope KMS boundary | 候選版本預計在已鎖定 ECS 內以 loopback、獨立 CA、獨立 master key、每 workload 精確 ACL 提供 | 不復用正式 master key、catalog 或 bearer；未知 token/ref/wildcard 一律拒絕。三個 child process 仍共享同一 DynamicUser 與父進程環境，任一 child 完全失陷即視為整個本地 secret domain 失陷；這只可作隔離 staging 的明示接受風險，不等同於阿里雲託管 KMS 或獨立安全域。若批准必須使用託管 KMS，需另行增加 adapter 與資源報價後再部署 |
| 短信 | 既有簽名／驗證碼模板的 staging 驗收；ECS RAM role 僅 `dysms:SendSms` | 不建立 AccessKey；P11 只保留 BizId/request ID 摘要，Codex 不取得驗證碼 |

P04 必須明確選擇「接受本候選的 ECS 內自管 Secret Store/KMS」或「改為阿里雲託管 KMS／Secrets Manager」。後者目前尚未實作，會新增 adapter、雲資源、RAM 權限、Internal Runtime 出站網路與輪換／負向授權證據；選擇後者時，本候選不得進入 P05 部署。

4 vCPU / 8 GiB 是避免 Node API、兩組 Jobs、三個 loopback 內部服務、Caddy 與 TLS proxy 在同一主機互相擠壓的驗收基線，不代表正式容量。P03 必須先只讀記錄候選 ECS 的實際規格；若低於基線，不得在未批准的情況下升配或直接部署。若批准以 2 vCPU / 4 GiB 驗收，必須重新跑 P07、P10、P12 的完整負載與重啟驗證。

## Security Group 最小規則

- 入站 `80/tcp`、`443/tcp`：公網，僅供 ACME 與 staging HTTPS；P10 前不啟動 Caddy。
- 入站 `22/tcp`：預設不開 `0.0.0.0/0`；只允許 Ethan 當前固定出口 IP，或完全改用阿里雲 Workbench／Cloud Assistant。
- `4431`、`55442`、`8643`、`8644`、`8645`：禁止安全組入站，只能 loopback。
- RDS `5432`、Tair 服務埠：只允許已鎖定 staging ECS 的專用安全組／私網來源。
- 出站：DNS、HTTPS、RDS、Tair、ECS IMDSv2 所需地址；其餘依部署時可觀測結果再收斂。

## 主機軟件基線

- Node.js `>= 22.22`
- systemd 與 `systemd-analyze >= 252`
- Caddy `>= 2.8`
- `psql`、`pg_isready >= 16`
- OpenSSL `>= 3`

P07 會驗版本並對 9 個 candidate unit 執行 `systemd-analyze verify`。P10 會驗證已安裝 unit 與 release bytes 相同、沒有額外 drop-in、`NeedDaemonReload=no`；Caddy 的 active config、唯一 drop-in、Host env 與 DNS 也必須綁定同一新公網 IPv4 摘要。

## 成本批准方式

ECS、RDS、Tair 的實例與存儲單價會隨地域、規格和優惠變動，最終只能採用**登入後的北京控制台即時資料**。ECS 部分採已鎖定候選的當前計費／規格頁及任何擬議升配頁；RDS、Tair 購買頁保持在提交訂單前。將三部分的規格、按量單價與預估月費截圖／導出資料填入 `staging-cost-approval.example.yml`，再計算 SHA-256；P04 只接受該份報價與本規格的摘要，不接受口頭估價。P04 成本批准不等同於備份、改名、改網路／RAM role、建立 RDS/Tair 或部署授權。

成本口徑：

- 72 小時驗收：`ECS 小時價 × 72 + RDS 小時價 × 72 + RDS 存儲 + Tair 小時價 × 72 + ECS 公網出流量 + 短信`。
- 30 天常駐：按 730 小時估算，再加公網出流量、超額備份／日誌等可選費用。
- 國內驗證碼／通知短信在每月不超過 10 萬條的現行按量價為 `¥0.045/條`；正式下單前仍以短信控制台為準。
- P12 結束後如不再使用，先取得需保留的測試證據／備份，再由 Ethan 單獨批准釋放；本部署批准不自動包含刪除。

官方計費依據：

- [ECS 按量付費](https://help.aliyun.com/zh/ecs/pay-as-you-go-1)
- [RDS 計費項](https://help.aliyun.com/zh/rds/product-overview/billable-items-billing-methods-and-pricing/)
- [Tair 計費項](https://help.aliyun.com/zh/redis/product-overview/billable-items/)
- [2026-05-20 起國內短信價格](https://help.aliyun.com/zh/sms/product-overview/notice-on-price-adjustment-for-domestic-sms-services-2604)

## 批准後的唯一下一步

P03 先完成候選 ECS 的只讀盤點。Ethan 明確批准**具體復用／硬化規格、控制台總價與成本硬上限**後，P05 仍須逐項取得當次寫操作授權：先獲准建立候選 ECS 的備份／快照並驗證可恢復，再分別批准改名為「福福網 staging」、資源組／VPC／vSwitch／安全組／RAM role 調整、建立新 RDS/Tair，以及主機登入與部署；前一步批准不自動涵蓋後一步。本次不新建 ECS，且本文件本身沒有授權建立 RDS/Tair 或修改任何資源。任何頁面若顯示不同地域、正式資源組、正式 ECS `i-2zeewhay0farxq8lucrd` 或非本文件規格，立即停止，不提交訂單或變更。
