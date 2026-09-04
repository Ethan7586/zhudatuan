# 2026-08-27 API 收斂與權限修復日誌

## 決策

本輪不把 8 月 21 日快照原碼覆蓋到 `main`。比對證明 21 號的 206 個 Canonical Operations 是現行 217 個 Operations 的嚴格子集；快照獨有的 Operation、Capability、Event、Migration 與後端 Service Source 均為 0。

正式邊界固定為：

- `services/commerce`：唯一目標 API 與 Canonical 權限模型。
- `services/commerce-api`：`apps/storefront-web` 暫時使用的隔離相容 BFF。
- `archives/smart-wing-20260826/smart-wing`：8 月 21 日行為、工作台覆蓋和測試需求的歷史參考，不是部署來源。

兩條 API 在真資料庫、身份、支付與合同 Adapter 完成前均保持 `releaseEligible=false`，真值見 [`config/artifacts.json`](../../config/artifacts.json)。

## 三源矩陣

| 項目                           | main Canonical | 8 月 21 日快照 | 結論                                 |
| ------------------------------ | -------------: | -------------: | ------------------------------------ |
| Operations                     |            217 |            206 | main 新增 11                         |
| GET                            |             87 |             83 | main 新增 4                          |
| 寫操作                         |            130 |            123 | main 新增 7                          |
| Capabilities                   |            186 |            175 | main 新增 11                         |
| Events                         |             58 |             57 | main 新增 `identity.session.revoked` |
| 核心 DB Migrations（比對當時） |            164 |            140 | main 新增 24                         |
| 21 號獨有後端原碼              |              — |              0 | 不需要搬回                           |

main 新增的 11 個 Operations 分佈為 Identity 6、Organization 2、Benefit 1、Observability 2。共享的 206 個 Operations 在 method、path、owner、permission、idempotence、requirements、controller 與 handler 上一致。

21 號前端曾以通用工作台做到 182/206 靜態可達、110/123 寫操作可達；加上 Miniapp 後為 186/206、111/123。這是歷史覆蓋證據，不是現行真 API E2E 證據。

現行 Console 靜態使用約 40 個 Canonical Operation factories；Storefront 對 `@shop/sdk` 的直接使用為 0，仍走相容 REST。相容層有 72 個 route patterns、92 個 RPC 名稱；其 RPC 在相容 Migration 中靜態閉合，但與 Canonical REST 路徑幾乎不重合，不能只改 Base URL 接通。

## 2026-08-27 已驗證

- Canonical Contract：12/12。
- Canonical Commerce Unit：修復前 122/122；加入 target/audience 邊界後 127/127。
- Canonical Commerce Contract：7/7。
- Compatibility API：加入 target router 邊界後 179/179。
- Migration Inventory／Schema Replay：165 個 Migration，94 historical + 71 repair。
- MVP Kernel：購物車 → 報價 → 訂單 → 支付 → 履約 → 財務分錄完整通過，Outbox、Audit、冪等與借貸平衡證據成立。
- `npm audit --omit=dev`：0 個已知 production vulnerability。

已取得 GitHub Service Container 中 PostgreSQL 17、Redis 7.4、Repository 與 Adapter 的遠端證據。尚未取得的證據：雲端 Supabase／RDS 預發布環境、微信登入、短信、微信支付、11 個 Provider 沙箱與完整瀏覽器 E2E。這些未完成前只能稱「正式程式層與部署映像基線可用」，不能稱「外部業務完全接通」或「已可切正式流量」。

## 本輪修復

1. 將 Repository Root 門禁由歷史名稱 `shop` 對齊正式 `zhudatuan-main`。
2. 重建 Workspace Lock，移除已不在 `main` 的五個舊 App 條目。
3. Local Infra 只為實際存在的 Canonical Client 寫環境文件，不再製造不存在的 App 目錄。
4. 補回被 `.env*` 規則誤忽略的 `services/commerce/.env.jobs.example`。
5. 修正 MVP Kernel 的 Experience Application 新必填欄位。
6. 新增 `20260821080000_restore_member_scope_authorization.sql`：保留 Partner Scope 的同時，恢復會員對本人與商城組織的 RLS 可見性。
7. Canonical Access Pipeline 新增 Audience/Target 中央邊界：`operator` Operation 只允許 `target=console`，在 Handler 執行前拒絕錯誤 Client。
8. Compatibility Router 按 `membership.target` 單一路由，Storefront 與 Admin 不再互相嘗試對方 Handler；共用身份安全接口獨立處理。
9. 建立選定制品清單與 CI Baseline；不再用缺少六端 App 的舊 Hard-cut Release Workflow 假裝可發布。
10. 鎖定 GitHub Ubuntu 與 Alpine x64 所需的 Rolldown、Lightning CSS、Tailwind Oxide、esbuild、Workerd、OXC、Sharp 等 Native Binding，並讓 Lock 門禁自動檢查 Linux x64 閉包。
11. 校正整合測試的模組總數：28 個業務域加 Runtime、Observability，共 30 個；Observability 的兩個正式 Contract Operations 保留不刪。
12. 修復阿里雲 Dockerfile 的構建腳本輸入，Commerce Bundle 內建 `pg` 與 `redis`；最終 Runtime 不再依賴未被複製的 `node_modules`。
13. 新增 `.dockerignore`，禁止 `.env`、本機依賴、舊 Dist、Cache 與 Git Metadata 進入映像構建上下文。

## 2026-08-28 GitHub 遠端驗收

- 受驗提交：`3a5f3a3496d7e69a409af108d36b5217fa453e51`。
- 證據：[Main Baseline Run 33095749724](https://github.com/Ethan7586/zhudatuan/actions/runs/33095749724)，結論 `success`，耗時 9 分 10 秒。
- 通過階段：乾淨 `npm ci`／制品鎖定、165 Migration／MVP Kernel、TypeScript 與 Unit／Contract／Component／Journey／Security／Performance、PostgreSQL／Redis Repository 與 Adapter、三 App／兩 Service 構建、Alpine Commerce Image、Production Audit 與 Source Drift。
- 這一結果關閉了「main 能否在乾淨 Linux 與真 PostgreSQL／Redis 上重建」的問題；外部供應商、支付與正式雲環境仍按 `releaseEligible=false` 關閉發布。

## 後續權限工作

P0：

1. 在 GitHub CI 的真 PostgreSQL／Redis Service 上完成 Repository、Adapter 與跨 Scope 負例。
2. 建立 Compatibility 86 → Canonical 164 的明確 Permission Mapping；沒有映射一律 Deny。
3. 新增 Membership Role Assign/Revoke、Explicit Deny/Override 的正式 Operation、Typed Receipt 與 Authoritative Reread。
4. 補 Owner／Self Protection、Grant Ceiling、Deny-first、Access Version 失效和 Action Proof 的資料庫測試。
5. 合同升版，或讓 Client／Server 同時校驗 Version + Checksum，消除兩套 `1.0.0` checksum 不同的風險。

P1：

1. `access.center.read`、`member.members.read` 改為 Organization Closure-aware。
2. Access Read Model 補齊 Permission Catalog、System/Owner/Editable Role Metadata、Assignment、Deny、有效期與 Grant Ceiling。
3. 敏感寫操作統一接入 `identity.stepup.start/complete`、Reason、Idempotency、`If-Match`、Receipt 與 Reread。
4. Console 側欄與直接路由按 Permission + Capability 裁剪；後端 403 仍是唯一權威。

## 不可誤解的結論

- API 原碼已保全，不等於 API 已部署。
- 217 是正式目標合同；206 只作歷史參考，不回搬。
- Compatibility BFF 可以繼續修復與驗證，但不可直接併入 Canonical Database。
- 只有 CI 真資料庫、真身份與外部 Provider 驗收均通過後，才可以把 `releaseEligible` 改為 `true`。
