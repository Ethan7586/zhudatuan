# 2026-08-28 財務系統升級日誌

## 正式基線與邊界

- 唯一可寫工程：`/Users/Ethan/Desktop/Projects/zhudatuan/main`
- 分支：`main`
- 起始 HEAD／upstream：`32ab967e6e51bcad0ce9d2140cf4b64f1697420b`
- 起始工作樹已有非財務變更：`DEPLOYMENT.md`、`README.md`、兩份 decision 文檔及 `projects/`；本任務保留且不覆蓋其既有內容。
- archive、舊 Smart Wing、`/Users/Ethan/Desktop/Projects/suanchouweiwo` 禁止寫入。
- Owner 授權範圍：finance／invoice 後端、財務 API／Operation、財務 Migration、Console 財務頁面、財務權限／審計接線及財務測試。
- 禁止範圍：部署、DNS、雲資源、支付 Provider 實際配置及其他非財務業務；若需跨訂單、支付、卡券、供應商或分銷共同修改，先停止交界改動並回報 Command Center。
- 交付限制：不提交、不推送、不生產部署；先完成本地預覽、測試證據、風險與重新評分。

## 審計基線

統一評分為 **50/100**，MVP 目標為 **85/100**：

| 維度 | 滿分 | 起始主要缺口 |
| --- | ---: | --- |
| 業務覆蓋 | 25 | 應收、應付、渠道清算、分銷佣金子帳口徑不完整 |
| 帳務與資料正確性 | 25 | 混合 Tender 偽差異、單向對帳、Scope 總額 statement 不是真實試算平衡 |
| 對帳／結算／異常閉環 | 20 | 差異安全預覽／提交／回執不完整，結算與打款 uncertain 證據不足 |
| 權限／安全／審計 | 15 | action proof、ExpectedVersion、RLS、Invoice Scope、讀審計及帳本寫邊界缺口 |
| VI／UI／UE | 15 | 六頁籤權威 API 覆蓋不完整，部分高風險動作僅以文案表示關閉 |

## 里程碑與 Migration 順序

| 階段 | 狀態 | 預定 Migration | 證據／得分 |
| --- | --- | --- | --- |
| 0. 基線、Owner 邊界與正式決策 | 進行中 | 無 | HEAD、git status、現有合同／Migration／服務／Console 已核對；維持 50/100 |
| 1. 對帳正確性 | 進行中 | `20260828091000_finance_reconciliation_integrity.sql`（如需） | 待補 |
| 2. 安全與權限邊界 | 進行中 | `20260828092000_finance_security_boundaries.sql`（如需） | 待補 |
| 3. 試算平衡、子帳與期間關閉 | 進行中 | `20260828093000_finance_accounting_integrity.sql`（如需） | 待補 |
| 4. Console 六頁籤與權威 API | 待開始 | 無或依合同變更追加 | 待補 |
| 5. 全鏈路驗收 | 待開始 | 依實際最終順序 | 待補 |

## 已確認的實作原則

- 所有金額以資料庫 `bigint` 安全整數保存；API 不得以 JavaScript 浮點數冒充可無損的任意 `bigint`。
- 會計期間使用明確法定時區與半開區間，試算平衡按 Scope／帳簿／科目／幣種保存開期、借方、貸方及期末餘額。
- posted journal、entry 與凍結快照不可更新或刪除；更正採新 journal 並保存 `reversal_of`／`correction_of` 關聯。
- 對帳必須同時發現外部有／內部無與內部有／外部無，並對 fee／adjustment／fulfillment／many-to-one 明確支持或明確拒絕。
- 高風險寫入須閉合 Preview → Confirm → Level 3 Step-up → action-bound proof → ExpectedVersion → Idempotency → Execute → authoritative reread → receipt／effect_id。
- production 不讀 Fixture；瀏覽器不計算帳務金額、全量狀態計數或結算結果。

## 測試紀錄

尚未產生本輪修改後測試結果。最終至少記錄：聚焦 unit／contract、Migration fresh replay、真實 PostgreSQL DB 行為、跨 Scope RLS、integration、財務 Browser E2E、typecheck、lint、build、axe 與 `git diff --check`。

## 相容、回滾與發布基線

- 新 Migration 必須只前向追加，不改寫歷史 Migration；資料回填須可核對來源／目標 hash、筆數與金額。
- 錯帳以不可變沖正處理，不以刪除或更新 posted journal 回滾。
- Console 對尚未部署的新欄位／Operation 採 fail-closed；不得以 Fixture fallback 掩蓋合同不匹配。
- **已確認發布基線：尚未成立。** 部署任務不得使用本工作樹作已批准發布輸入，直至本日誌明確改為成立並列出完整 HEAD／Migration／測試證據。

## 剩餘 P0 風險

1. 混合支付／退款 Tender 級匹配與雙向差異尚未完成本輪驗證。
2. Statement 尚未改為逐科目／逐帳簿試算平衡。
3. action proof、ExpectedVersion、核心 finance／invoice RLS 與帳本寫入權限尚未完成本輪閉合。
4. 差異提案與四眼執行、結算付款回執、期間關閉前置驗證尚未完成全鏈路測試。
5. Console 六頁籤仍需以權威 API 和正式 disabled 狀態驗收。

## 2026-08-30：本地 90 分驗收

### 驗收基線與邊界

- 本次核對 HEAD：`01f1ed49dd5df67d28956a116de066f5fa1d5668`；工作樹包含多任務未提交內容，財務任務只追加自身範圍並保留其他變更。
- 所有寫入均位於 `/Users/Ethan/Desktop/Projects/zhudatuan/main`；archive、舊 Smart Wing 與 `suanchouweiwo` 未作任何寫入。
- Owner 已批准解除財務暫停、Payment provider `occurredAt` 最小證據交界與本地驗收 build；本輪沒有提交、推送、上傳、部署、DNS／Caddy／服務切換或 Provider 配置變更。
- 部署與 VI 凍結仍有效；當前財務工作樹不是線上基線，亦不得混入既有註冊／登錄 Release。

### 實際完成

1. 完成混合 Tender／Allocation 與部分退款口徑、雙向差異、逐科目／逐帳簿試算平衡、不可變沖正、期間關閉前置檢查及子帳總帳核對。
2. 完成 action-bound proof 從 Identity 發放、SDK header、CORS、OperationController 到 AccessPipeline 的最小向後兼容接線；財務 critical writes 執行 Scope、Level 3、ExpectedVersion、冪等、RLS 及審計校驗。
3. 完成 reconciliation repair 的 read／preview／submit／decide／reverse 受控函數、五表 default-deny、顯式 REVOKE／EXECUTE、SchemaVersion 與完整 requestHash 綁定。
4. 完成財務政策讀模型與受控寫工作流：稅務規則及自定義欄位均支援新增、編輯、停用、revision、草稿、提交、批准與拒絕；正式 active pointer 只在四眼批准後切換。
5. 稅務規則支援國家／地區、稅種、商品稅務分類、HS Code、安全整數 `ratePpm`、含稅方式、捨入、優先級、有效期與來源；權威 active interval overlap 在資料庫鎖內拒絕。
6. 欄位定義支援 12 個適用模組與 14 種資料型別，單選／多選的選項約束由服務與資料庫共同校驗。
7. Console 規則頁接入 typed authoritative API；production 寫入閉合 server preview → Level 3 OTP → proof → execute → receipt → authoritative refetch。本地演示資料只存在 session，無 production Fixture fallback。
8. 六頁籤、URL 狀態、搜尋／篩選、cursor 50 條邊界、差異抽屜、鍵盤／焦點、Axe 及高風險 fail-closed 已進入 Browser E2E。

### Migration 順序

1. `20260828091000_finance_reconciliation_integrity.sql`
2. `20260828092000_finance_security_boundaries.sql`
3. `20260828093000_finance_accounting_integrity.sql`
4. `20260828094000_finance_invoice_issue_integrity.sql`
5. `20260828095000_payment_provider_time_evidence.sql`
6. `20260828100000_finance_reconciliation_repair_workflow.sql`
7. `20260830100000_finance_configurable_policy_workflow.sql`

資料庫合同 inventory 已納入 `20260830` Migration，當前共 179 個 Migration（historical 94、repair 85）。沒有改寫歷史 Migration。

### 驗證證據

| 驗證 | 精確結果 |
| --- | --- |
| Commerce finance／共享安全 unit | 15 files、57 tests passed |
| Commerce 真資料庫行為 integration | 7 files、56 tests passed |
| Config policy unit／replay | 12/12；4/4 passed |
| Console finance unit | 7 files、42 tests passed |
| Contract／SDK | 4 files、16 tests；6 files、15 tests passed |
| Finance Browser E2E | 6/6 passed，包含 Axe／WCAG |
| TypeScript | commerce、console、SDK、contractgen、browser 全部通過 |
| Contract generation | `generate` 與 `check` 通過 |
| Database contract／inventory | 179 個 Migration PGlite fresh replay 與 inventory 通過 |
| 真 PostgreSQL | PostgreSQL 17 隔離環境 179 個 Migration 全量 replay 通過 |
| Quality gates | 定向 ESLint、Prettier、console production build、`git diff --check` 全部通過 |

真資料庫行為覆蓋混合支付／部分退款、雙向差異、手續費與不支援匹配拒絕、差異四眼、結算／打款回執與 uncertain、期間關閉／遲到事件／沖正、發票紅沖、跨 Scope RLS、子帳總帳核對，以及稅務／欄位政策新增、編輯、停用、重放、併發、過期、錯誤 hash 與 active interval 重疊。

### 重新評分

| 維度 | 得分 | 驗收結論 |
| --- | ---: | --- |
| 業務覆蓋 | 22/25 | 財務主閉環與可配置稅務／欄位治理成立；尚未跨商品／訂單接稅額快照及通用欄位值 |
| 帳務與資料正確性 | 23/25 | Tender、雙向對帳、試算平衡、不可變沖正與真 DB 證據成立 |
| 對帳／結算／異常閉環 | 18/20 | 差異修復、四眼、回執、uncertain／recovery 已驗證；部分高風險入口仍保持關閉 |
| 權限／安全／審計 | 14/15 | proof、Level 3、ExpectedVersion、RLS、冪等與審計閉合；尚未形成生產發布證據 |
| VI／UI／UE | 13/15 | 六頁籤、規則與欄位編輯、URL 恢復、可訪問性與 fail-closed 成立 |
| **合計** | **90/100** | **本地 MVP 驗收成立；不等同生產發布** |

### 相容、回退與沖正

- 所有 DB 變更均採 forward-only Migration；唯一約束調整只移除舊的「同 Scope／同 kind 僅一筆」限制，保留既有資料及 policy identity。
- 新政策在批准前不改變 active pointer；拒絕或過期不影響既有正式版本。已啟用配置的業務回退以新 revision 或受控 retire 完成，不刪除歷史 revision。
- 已 posted 帳務只能建立不可變 reversal／correction，不直接更新或刪除；歷史來源、target hash、effect 與 receipt 保留可追溯。
- 舊客戶端不具備新 capability／proof 時得到明確拒絕；Console 合同不匹配、缺權限或缺 Step-up 時 fail-closed。
- Payment provider 事實時間只保存已驗簽 `occurredAt`／effect 證據供 Finance 唯讀驗證，不改支付狀態機、Provider 配置或 API payload，也沒有歷史回填。

### 仍未解決的風險

1. 稅務配置與有效期治理已成為權威流程，但商品／訂單成交時計算、司法轄區判定與不可變稅率快照屬跨域合同，未在本階段接入。
2. 自定義欄位目前是定義與元資料治理；尚未加入任意業務記錄的通用值儲存、索引、校驗與報表語義。
3. 高風險「匯出對帳單」與「發起對帳」在缺獨立受控 Operation／完整回執時繼續 disabled，不模擬成功。
4. 所有成果仍在未提交本地工作樹，未進行生產資料 Migration、真實身份 Browser E2E 或線上驗收。

### 發布狀態

- **本地驗收基線：成立，90/100。** 可使用隔離 Preview API 與 Console 演示欄位／稅率配置及財務工作台。
- **已確認發布基線：尚未成立。** 原因是未提交、未推送、未部署，且跨商品／訂單的稅率應用快照仍需另行批准。部署凍結期間不得把本工作樹用作線上輸入。
