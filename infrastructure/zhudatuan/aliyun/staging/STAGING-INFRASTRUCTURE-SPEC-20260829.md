# 主打團隔離公網 Staging 基礎設施規格

狀態：**待 Ethan 核對與明確批准；本文件不授權建立或修改任何雲資源。**

版本日期：2026-08-29　地域：華北 2（北京）`cn-beijing`

## 已確認現狀

- 北京 RDS PostgreSQL：0 個實例。
- 北京 Tair：0 個實例。
- KMS 目前只確認產品總覽可見，未確認實例、密鑰或憑據已配置。
- ECS `i-2zeewhay0farxq8lucrd` 正在承載 `accounts.zhudatuan.com`、`console.zhudatuan.com`、`api.zhudatuan.com`，永久排除出 staging；不得登入、安裝、上傳、改 RAM role／安全組或 Caddy。
- 北京現確認共有 2 台 ECS。第二台「小服務器」的實例 ID、當前名稱、狀態、磁碟與承載內容尚未完成只讀辨識；Owner 希望它未來改名為「福福網」，但改名屬另一項資產寫操作，必須在精確鎖定實例、完成並驗證備份且得到當次明確批准後才可執行。在此之前它不得被標記或使用為 staging，也不得登入、快照、備份、改名或執行任何寫操作。
- RAM 角色 `zhudatuan-identity-notification` 只確認列表可見；尚未審閱有效策略，不能推定可用或可修改。

## 隔離拓撲

```text
Internet :80/:443
        │
全新 staging ECS（唯一公網入口；Caddy）
        ├─ 127.0.0.1:4431  Identity API
        ├─ 127.0.0.1:55442 PostgreSQL TLS proxy ── private TLS ── 新 RDS
        ├─ 127.0.0.1:8643  staging Secret Store
        ├─ 127.0.0.1:8644  staging KMS boundary
        ├─ 127.0.0.1:8645  staging Object Store
        └─ private TLS ───────────────────────────── 新 Tair
```

新 ECS、RDS、Tair 必須位於新建的 staging resource group 與專用 VPC／vSwitch；不與正式 VPC 做對等連接，不使用正式私網 endpoint、Secret namespace、資料、備份或 Caddy route。

## 建議資源

| 資源 | 建議配置 | 強制安全邊界 |
| --- | --- | --- |
| Resource Group | 新建 `zhudatuan-staging-isolated` | 只含本次新 ECS、RDS、Tair 及其網路資源 |
| VPC / vSwitch | 新 VPC；建議 `10.68.0.0/16`、單 vSwitch `10.68.1.0/24`，建立前先只讀確認不重疊 | 不接正式 VPC；三個運算／資料資源同 vSwitch |
| ECS | 按量付費、Linux x86_64、建議 4 vCPU / 8 GiB、40 GiB ESSD、單一新公網 IPv4、按使用流量計費、5 Mbps 峰值 | 新 RAM role；22 只允許受控來源或使用 Workbench；80/443 公網；443 出站；RDS/Tair 僅私網；禁止任何正式域名 |
| RDS PostgreSQL | PostgreSQL 16、基礎系列、建議 2 vCPU / 4 GiB、50 GiB ESSD、按量付費 | 無公網 endpoint；TLS；只允許 staging ECS；登記 exact 私網 IP；刪除保護；每日備份、PITR；Migration 前完成一次還原演練；控制面預建 inert boundary role |
| Tair / Redis | Redis 開源版 7.x、標準主從、1 GiB、按量付費 | 無公網 endpoint；TLS、密碼、AOF、備份；只允許 staging ECS |
| Secret Store / local envelope KMS boundary | 候選版本目前在新 ECS 內以 loopback、獨立 CA、獨立 master key、每 workload 精確 ACL 提供 | 不復用正式 master key、catalog 或 bearer；未知 token/ref/wildcard 一律拒絕。三個 child process 仍共享同一 DynamicUser 與父進程環境，任一 child 完全失陷即視為整個本地 secret domain 失陷；這只可作隔離 staging 的明示接受風險，不等同於阿里雲託管 KMS 或獨立安全域。若批准必須使用託管 KMS，需另行增加 adapter 與資源報價後再部署 |
| 短信 | 既有簽名／驗證碼模板的 staging 驗收；ECS RAM role 僅 `dysms:SendSms` | 不建立 AccessKey；P11 只保留 BizId/request ID 摘要，Codex 不取得驗證碼 |

P04 必須明確選擇「接受本候選的 ECS 內自管 Secret Store/KMS」或「改為阿里雲託管 KMS／Secrets Manager」。後者目前尚未實作，會新增 adapter、雲資源、RAM 權限、Internal Runtime 出站網路與輪換／負向授權證據；選擇後者時，本候選不得進入 P05 部署。

4 vCPU / 8 GiB 是避免 Node API、兩組 Jobs、三個 loopback 內部服務、Caddy 與 TLS proxy 在同一主機互相擠壓的驗收配置，不代表正式容量。若要用 2 vCPU / 4 GiB 降本，必須重新跑 P07、P10、P12 的完整負載與重啟驗證。

## Security Group 最小規則

- 入站 `80/tcp`、`443/tcp`：公網，僅供 ACME 與 staging HTTPS；P10 前不啟動 Caddy。
- 入站 `22/tcp`：預設不開 `0.0.0.0/0`；只允許 Ethan 當前固定出口 IP，或完全改用阿里雲 Workbench／Cloud Assistant。
- `4431`、`55442`、`8643`、`8644`、`8645`：禁止安全組入站，只能 loopback。
- RDS `5432`、Tair 服務埠：只允許新 staging ECS 的安全組／私網來源。
- 出站：DNS、HTTPS、RDS、Tair、ECS IMDSv2 所需地址；其餘依部署時可觀測結果再收斂。

## 主機軟件基線

- Node.js `>= 22.22`
- systemd 與 `systemd-analyze >= 252`
- Caddy `>= 2.8`
- `psql`、`pg_isready >= 16`
- OpenSSL `>= 3`

P07 會驗版本並對 9 個 candidate unit 執行 `systemd-analyze verify`。P10 會驗證已安裝 unit 與 release bytes 相同、沒有額外 drop-in、`NeedDaemonReload=no`；Caddy 的 active config、唯一 drop-in、Host env 與 DNS 也必須綁定同一新公網 IPv4 摘要。

## 成本批准方式

ECS、RDS、Tair 的實例與存儲單價會隨地域、規格和優惠變動，最終只能採用**登入後的北京售賣頁即時報價**。先把三個購買頁保持在提交訂單前，將含規格、按量單價與預估月費的截圖／導出資料填入 `staging-cost-approval.example.yml`，再計算 SHA-256；P04 只接受該份報價與本規格的摘要，不接受口頭估價。

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

Ethan 明確回覆批准**具體規格與控制台總價**後，才進入 P05：先建立全新 resource group／VPC／vSwitch／安全組，再建立 ECS、RDS、Tair。任何購買頁若顯示不同地域、正式資源組、既有 VPC 或非本文件規格，立即停止，不提交訂單。
