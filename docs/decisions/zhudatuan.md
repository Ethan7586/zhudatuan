# 築大團系統問答

> 智慧翼／築大團 MVP 的產品口徑、系統邊界與已確認決策。  
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
> 最後更新：2026-08-28

## 2026-08-28：hbbtzn 成為築大團子項目

`hbbtzn` 正式定位為築大團平台下的**獨立部署／租戶子項目**，目錄為 `projects/hbbtzn/`。

- 築大團仍是主項目與唯一正式代碼平台；hbbtzn 不建立第二套 App／Service／Database fork。
- hbbtzn 可以引用 `config/artifacts.json` 已批准的共享制品，但不能自行增加正式制品或進入根 npm Workspace。
- hbbtzn 的域名、資料庫、Redis、OSS、KMS／Secret、微信／支付／短信憑據、發布、驗收和回滾必須獨立。
- 目前只完成子項目身份與配置邊界；hbbtzn 保持原狀，不遷移、不下線、不改 DNS、不切資料，也不納入 `zhudatuan.com` 主站部署。
- 舊 Smart Wing 代碼繼續保留在 `../archives/` 作只讀提詞庫；不得複製整套歷史代碼回正式工程。
- hbbtzn 仍存在舊域名與 Cookie／Host／回跳／支付回調硬編碼，只有完成配置化和獨立環境驗收後，才能宣稱運行隔離完成。

機器可讀項目身份見 [`../../projects/hbbtzn/project.yml`](../../projects/hbbtzn/project.yml)，完整責任邊界見 [`../../projects/hbbtzn/README.md`](../../projects/hbbtzn/README.md)。

## 2026-08-27：正式工程與歷史提詞庫分離

`/Users/Ethan/Desktop/Projects/zhudatuan/main` 是唯一正式工程、Git 倉庫、構建與部署來源；同層的 `../archives/` 是築大團未來的歷史提詞庫與代碼找回庫。

- 需要舊版 VI／UI／UE、登入、會員權限、商品、訂單、支付、供應商、接口契約或部署經驗時，先在 `archives/` 搜尋。
- 找回時必須記錄來源路徑、Git commit／branch 與工作樹狀態，再判斷是否適合目前契約。
- 只提取本次需要的最小代碼與業務語義，重新接入 `main/` 並補測試；不得整包搬運。
- `archives/` 不是正式開發目錄、運行時依賴、現行契約真值或部署來源。
- 正式 `.git` 位於 `main/.git`；`archives/` 在該 Git 工作樹之外，因此不會被 GitHub、構建或部署誤收錄。

完整使用規則見 [`archives/README.md`](../../../archives/README.md)。

## 2026-08-28：前後端分離完成度評估

### 結論

- **全平台前後端分離：74/100。** 這是 `Console + Storefront + Auth + 兩套 API／資料庫` 的工程架構分離度，不是 UI 完成度或生產上線分數。
- **新版營運後臺鏈路：91/100。** `apps/console → @shop/sdk／@shop/contract → services/commerce → database/supabase` 已形成清晰的前端、合同、服務和資料庫邊界。

因此準確判定是：**架構已經前後端分離，但目前是「營運後臺鏈路高度完成、消費與身份鏈路仍在過渡」，還不是全平台完全分離。**

### 五項核分

| 評估項目 | 分數 | 判定 |
| --- | ---: | --- |
| 前端獨立構建與部署 | 14/20 | Console、Storefront、Auth 均有獨立構建入口；但 Storefront Worker 直接嵌入 Compatibility API Router，消費前端與 BFF 尚不能完全獨立替換和擴容。 |
| API 合同 | 15/20 | Canonical 217 Operations、生成 SDK、輸入／輸出校驗、合同版本與冪等規則完整；Storefront 仍維護另一套手寫 REST Types／Paths。 |
| 資料庫訪問邊界 | 18/20 | 瀏覽器不直接持有資料庫密鑰，Canonical PostgreSQL／RLS 邊界清楚；但 Compatibility BFF 隨 Storefront 部署並持有獨立 Supabase service role。 |
| 身份與跨域邊界 | 13/20 | Canonical 已有 Origin 白名單、credentialed CORS、CSRF、Secure／HttpOnly Cookie；Auth 仍使用 Compatibility `/api/v1/auth/*`、舊 target 語義和舊域名回退，`accounts.zhudatuan.com` 尚未完成運行接入。 |
| 測試與可替換性 | 14/20 | 已有合同、PostgreSQL／Redis、Journey、安全、性能及構建驗證，SDK Transport 可替換；但正式瀏覽器 E2E 未進當前 CI，前端完整邊界檢查仍引用尚未納入 `main` 的 Miniapp／舊 Workspace。 |
| **合計** | **74/100** | **已分離，但兩條技術軌道尚未收斂。** |

### 已經成立的邊界

- 正式工程把三個前端放在 `apps/`、兩個服務放在 `services/`、合同與 SDK 放在 `packages/`、Migration 放在 `database/`。
- Console 不直接操作資料庫，統一經生成 SDK 調用 Canonical API；寫入具備 Scope、Access Version、Idempotency、Expected Version 與 Step-up Proof 等上下文。
- 瀏覽器源碼未直接使用資料庫 Service Role；資料庫訪問留在服務端。
- `check:artifacts` 與 `check:boundaries` 已通過，當前選定制品和代碼依賴邊界沒有違規。

### 剩餘 26 分如何補齊

1. 把 Storefront／Auth 從 Compatibility REST 合同逐步接到 Canonical Operations，或建立正式、版本化且可獨立部署的 Adapter／BFF。
2. 取消 Storefront Worker 對 `services/commerce-api` 源碼 Router 的直接嵌入，讓 Web 靜態制品與 API 服務可以獨立部署、擴容、替換和回滾。
3. 收斂 Canonical／Compatibility 雙合同與雙資料庫，保留明確遷移期，但不讓兩套業務真值長期並存。
4. 正式接通 `accounts.zhudatuan.com`，清除 `smart.hbbtzn.com` 等舊域名回退和 `admin/storefront` 舊 target 語義。
5. 修正前端邊界檢查與 Playwright Workspace 漂移，將真實 Browser → API → PostgreSQL 的登入、購物、支付與後臺操作 E2E 納入 CI。
6. 完成真雲端資料庫、短信、微信、支付及 Provider 驗收後，再將相應制品的 `releaseEligible` 由 `false` 改為 `true`。

本次評估只記錄架構現況，未修改前端、後端、合同、資料庫或部署代碼。
<<<<<<< HEAD
=======
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
> 最後更新：2026-08-27

## 2026-08-27：正式工程與歷史提詞庫分離

`/Users/Ethan/Desktop/Projects/zhudatuan/main` 是唯一正式工程、Git 倉庫、構建與部署來源；同層的 `../archives/` 是築大團未來的歷史提詞庫與代碼找回庫。

- 需要舊版 VI／UI／UE、登入、會員權限、商品、訂單、支付、供應商、接口契約或部署經驗時，先在 `archives/` 搜尋。
- 找回時必須記錄來源路徑、Git commit／branch 與工作樹狀態，再判斷是否適合目前契約。
- 只提取本次需要的最小代碼與業務語義，重新接入 `main/` 並補測試；不得整包搬運。
- `archives/` 不是正式開發目錄、運行時依賴、現行契約真值或部署來源。
- 正式 `.git` 位於 `main/.git`；`archives/` 在該 Git 工作樹之外，因此不會被 GitHub、構建或部署誤收錄。

<<<<<<< HEAD
完整使用規則見 [`archives/README.md`](./archives/README.md)。
<<<<<<< HEAD
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
完整使用規則見 [`archives/README.md`](../../../archives/README.md)。
>>>>>>> 65499ddc (chore: finalize main baseline and restore API boundaries)

## 2026-08-27：會員與權限、渠道與分銷、系統治理台

### 問題一：目前相對 MVP 還差什麼？

目前不是重新設計三套系統，而是還差三類收口工作：

1. 找回已完成的「會員與權限」前端工作台與互動。
2. 將舊前端改接 2026-08-21 後的新 Contract、Scope、Membership、Access Version 與 Step-up 體系。
3. 補齊「渠道與分銷」的分銷經營頁，以及把現在名不副實的「系統治理台」改成真正的跨系統治理控制面。

這三部分完成後，仍須按真實登入、真實 Scope、真實 API、真實資料庫狀態轉換做 MVP 驗收；現有靜態 Journey 不能代替端到端驗收。

### 問題二：根據 MVP，「渠道與分銷」應該放什麼？

一句話定義：**管理誰把什麼能力與商品池分到哪裡，以及外部渠道如何接入、同步和回執。**

同一個頂級入口「渠道與分銷」內，必須分成兩組，不應只展示技術接口。

#### A. 分銷網絡（MVP04）

- 分銷總覽：訂單金額、訂單量、充值金額、上線平台數、利潤率與排行。
- 分銷商管理：列表、建立、編輯、停用、狀態、結算模式、名下 Tenant 數。
- 租戶／平台綁定：分銷商與 Tenant 的綁定狀態、有效期和證據。
- 能力與配額：可建立的平台／商城數、Capability、額度、啟停及到期時間。
- 商品池分配：把上游商品池授予分銷或下級 Scope，展示分配狀態與可見範圍。
- 分銷價格政策：成本價、分銷價、銷售價、毛利率或佣金規則。
- 經營結果：分銷報表與結算摘要；詳細帳單跳轉「財務與對賬台」，不在此重做一套財務系統。

後端已存在 MVP04 的主要合同：`channel.distributors.create/read/update/disable`、`channel.bindings.manage`、`channel.quotas.manage`、`catalog.pools.allocate`。

#### B. 渠道接入（MVP23）

- 渠道目錄與 P1 Provider 接入狀態。
- 渠道連接：合同版本、區域、憑據是否配置、測試、啟用與停用；Secret 永不回顯。
- 同步任務：商品、價格、庫存、渠道帳單的進度、游標、成功／拒絕數與取消。
- 外部操作：訂單、退款、履約回執及 unknown／failed 任務。
- Webhook 與受控重放：回調狀態、冪等結果、失敗原因與審計證據。

建議頁籤順序：

`總覽 → 分銷商 → 租戶綁定 → 配額與能力 → 商品池分配 → 渠道連接 → 同步任務 → 外部操作`

目前 `/channels` 只有「渠道連接／同步批次／外部操作」，所以它現在只是**渠道接入監控頁**，還不是完整的「渠道與分銷」。

不應放入本入口的內容：卡券操作、財務明細、會員檔案、商城裝修、商品日常治理。這些已有各自業務台；本頁只展示必要摘要和跳轉。

### 問題三：「會員與權限」是不是做過，可以直接找回？

**做過，而且完整工作台已找到；可以恢復視覺與互動，但不能把舊 API 原樣搬回。** 推薦以完整舊版基線 `358bc538214f3f64e553eefde2b6bf5b76e2b8c9` 取回所需組件，不整包回滾。

舊工作台位於：

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
`../../../archives/smart-wing-20260826/Shop/pre-contract-code-merge-20260820/smart-wing-membership-permissions/apps/admin-web/src/components/workstations/MembershipPermissionWorkstation.tsx`
=======
`archives/smart-wing-20260826/Shop/pre-contract-code-merge-20260820/smart-wing-membership-permissions/apps/admin-web/src/components/workstations/MembershipPermissionWorkstation.tsx`
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
`archives/smart-wing-20260826/Shop/pre-contract-code-merge-20260820/smart-wing-membership-permissions/apps/admin-web/src/components/workstations/MembershipPermissionWorkstation.tsx`
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
`../../../archives/smart-wing-20260826/Shop/pre-contract-code-merge-20260820/smart-wing-membership-permissions/apps/admin-web/src/components/workstations/MembershipPermissionWorkstation.tsx`
>>>>>>> 65499ddc (chore: finalize main baseline and restore API boundaries)

它已包含：

- 會員運營：邀請、編輯、批量導入、結果回饋。
- 授權與狀態：會員列表、暫停／恢復／移除、角色疊加、Scope Grant、明確拒絕。
- 自定義角色：建立、編輯、停用、權限風險分組。
- Owner 保護、高風險操作 Step-up、變更原因和授權審計。

需要保持的四個領域邊界：

- **Identity**回答「帳號是誰、如何登入、會話是否有效、認證強度與 Step-up 是否成立」。
- **Member**回答「消費者／員工會員的業務檔案、狀態、地址、導入與會員事實」。
- **Access Membership**回答「一個人與哪個組織存在任職關係、能管理什麼、在哪個 Scope 生效、有哪些明確拒絕、Access Version 是否仍有效」。
- **Qualification**回答「這個會員可見／可買什麼」；可以在「會員與權限」入口設相鄰頁籤，但不能把購買資格當成後台 RBAC 權限。

恢復時只復用舊版的 VI、頁面組合與互動邏輯；資料層改接目前的 `member.members.read`、`access.center.read`、`access.roles.manage`、`access.scopes.manage`、Identity 邀請與 Step-up 等正式 Operation，並按 Platform／Distributor／Enterprise／Mall 的 Scope 裁剪資料。

目前「結構對接」的實際缺口包括：

- 補 Membership 角色分配／撤銷與顯式 deny 的正式 Operation。
- Access 讀模型補齊權限目錄、角色元資料、Owner／System／可編輯狀態與授權上限。
- 高風險操作改接 `identity.stepup.start/complete`，綁定 action preview/proof；不能恢復舊版前端本地倒計時。
- 寫操作加入 `expectedVersion`、reason、idempotency、typed receipt 與 authoritative reread。
- 現有 Member／Access 查詢只精確匹配當前 `organization_id`，需要依組織 Closure 推導後代 Scope，才能讓 Platform／Distributor／Tenant 安全管理下級組織。
- 保留唯一 Owner、本人操作保護、grant ceiling、deny-first 與完整審計不變量。

### 問題四：「系統治理台」是什麼？

一句話定義：**它是跨 Scope 的規則、風險、證據與追責控制面，回答誰在什麼範圍內改了什麼、變更是否受控、出問題後如何追溯。**

相對 MVP，它不是獨立的一行，也不是「平台層所有功能」的雜物箱；它聚合 MVP03、MVP13、MVP22 中真正的治理能力。

MVP 階段應包含：

- 風險中心：風險策略、風險案件與人工復核。
- 通知治理：短信／通知模板、公告和發送邊界；渠道憑據仍歸「渠道與分銷」。
- 會話與安全：活躍／異常會話、強制失效、Step-up 證據；角色與 Scope 授權仍在「會員與權限」。
- 審計與追責：Actor、Scope、Action、Reason、Trace、變更前後狀態與證據。
- 組織／Scope 態勢：只讀查看平台、分銷、集團、商城層級與異常關係。
- 商城准入：未來承接平台對商城的審批、啟用和停用；必須等待正式 `mall.bootstrap` 與審批 Operation，現階段不能做假按鈕。

不屬於系統治理台：

- 會員檔案、邀請、角色、Scope Grant。
- 員工購買資格的日常配置。
- 商品、訂單、卡券、財務、客服、報表與商城裝修。
- Provider 連接、同步、Webhook 和失敗重放。
- 運行健康、隊列、事故與恢復；這些屬於「智慧翼中控台」。

目前側欄「系統治理台」實際指向 `/settings/qualification`，頁面內容只是資格策略，名稱與能力不相符。舊版 `SystemControlWorkstation` 也只是全局參數與審計的前端原型，沒有接入現在的正式後端，不能算已完成的系統治理台。

### 已確認的後續順序

1. 恢復「會員與權限」既有 VI/UI/UE。
2. 完成會員、Identity、Access、Qualification 與 Scope 的結構對接。
3. 補齊「渠道與分銷」的 MVP04 分銷網絡，同時保留 MVP23 渠道接入。
4. 將「系統治理台」從資格頁改為真正的風險、通知、安全與審計控制面。
5. 最後執行真實登入、真實 Scope、真實 API 與資料庫的 MVP 驗收。

當前狀態：**只完成定義、審計與記錄；未開始修改業務代碼，等待下一條指令。**
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)

## 2026-08-28：財務與對帳 MVP 升級決策

Owner 已批准在唯一正式工程 `main/` 內升級財務系統，目標由審計基線 **50/100** 提升至可驗證的 MVP **85/100**。本輪唯一寫入範圍是 finance／invoice 後端、財務 Operation 與合同接線、財務 Migration、Console 財務頁面、財務權限／審計及其測試；歷史 archive 僅可唯讀對照。

正式決策如下：

- 先閉合正確性與安全 P0：混合 Tender／Allocation、部分退款、雙向對帳、逐科目試算平衡、法定期間、不可變沖正、action-bound proof、ExpectedVersion、RLS、Invoice Scope 與最小帳本寫入邊界。
- 正式會計口徑須覆蓋訂單應收、供應商應付、渠道清算及分銷佣金；瀏覽器不得重算或推導權威金額。
- 差異處理採「提案／預覽 → Level 3 Step-up → 四眼復核 → 執行或沖正 → 權威回讀 → 審計回執」；發起人與復核人必須不同。
- 結算以凍結快照、規則版本和應付依據為準；打款必須保存回執並處理 uncertain／recovery。
- 期間關閉前必須驗證試算平衡、子帳與總帳一致、無未處理差異；已 posted 的 journal 不得直接修改或刪除。
- Console 六個財務頁籤只接 typed authoritative API；Fixture 只能用於隔離的瀏覽器視覺回歸，未授權或未實作的生產動作必須真正 disabled。
- 本輪不提交、不推送、不作生產部署，不修改 DNS、雲資源或支付 Provider 真實配置。只有 DB／權限／合同／E2E／build 證據全部成立後，才可標記「已確認發布基線」。

逐批文件、Migration、測試、得分、剩餘風險及回滾說明記錄於 [`../operations/2026-08-28-finance-upgrade-log.md`](../operations/2026-08-28-finance-upgrade-log.md)。

## 2026-08-28：先收旂登錄，再開始權限工作台

Owner 確認實施順序為「先登錄系統，後權限系統」，並批准開始。本輪保留 3003 三段式登錄 VI，將 Console 密碼登錄收旂到 Canonical Identity Session：PKCE 與一次性 Ticket 不進 URL，API 持有 Host-only Cookie，Console 保留服務端 CSRF，多身份選擇改由服務端權威確認。

當前可標記為「代碼／合同／安全測試／構建已通過」，不得標記為「真資料庫 E2E 或生產已上線」。真 DB 驗收被財務並行任務尚未收旂的 Migration 序列門檻阻擋；沒有繞過。Compatibility 帳號憑據轉入 Canonical 身份庫仍需單獨批准。完整證據與回退說明見 [`../operations/2026-08-28-canonical-console-login.md`](../operations/2026-08-28-canonical-console-login.md)。

## 2026-08-30：財務可配置欄位與稅務規則決策

Owner 批准財務系統解除暫停並向本地 MVP **90/100** 衝刺。本階段將「欄位」定義為受控、可版本化的財務元資料，而不是任意修改已入帳事實；所有正式變更繼續遵守 Preview、Level 3 Step-up、action-bound proof、ExpectedVersion、冪等與四眼復核。

正式決策如下：

- 欄位定義可新增、編輯、停用與版本化，資料型別覆蓋文字、整數、小數、日期／時間、布林、單選、多選、國家、地區、幣種、金額、百分比與引用。
- 欄位可作用於稅務規則、發票、結算、對帳、帳本、應收、應付、渠道清算、分銷佣金、提現與期間關閉；選項型欄位必須提供選項，其他型別禁止混入選項。
- 稅務規則以國家／地區、稅種、商品稅務分類、HS Code、百萬分率、含稅／未稅／複合方式、捨入、優先級、有效期間與依據來源表示；同類規則可並存，但同一適用範圍與有效期不得產生權威重疊。
- 正式啟用指標只在另一位復核人批准後切換；發起人不得批准或拒絕自己的提案。編輯與停用均生成新 revision，不覆蓋歷史版本。
- Console 本地預覽可以用 session-only 資料展示新增／編輯／停用；production 不讀 Fixture，缺權限、CSRF、Step-up 或能力時必須 fail-closed。
- 本階段沒有跨界修改商品／訂單稅額計算。商品成交時的稅率快照、司法轄區判定與歷史訂單重算策略，須由未來經批准的商品／訂單合同交界承接。
- 自定義欄位目前完成的是定義與治理，不包含所有業務記錄的通用欄位值儲存；帳務事實仍由 typed authoritative schema 與正式 Operation 管理。
- 本階段只形成可重現的本地驗收基線，不提交、不推送、不部署，也不把目前工作樹標記為生產發布基線。

完整 Migration、測試、得分與剩餘風險見 [`../operations/2026-08-28-finance-upgrade-log.md`](../operations/2026-08-28-finance-upgrade-log.md#2026-08-30本地-90-分驗收)。
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
