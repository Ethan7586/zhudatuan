# 築大團系統問答

> 智慧翼／築大團 MVP 的產品口徑、系統邊界與已確認決策。  
> 最後更新：2026-08-27

## 2026-08-27：正式工程與歷史提詞庫分離

`/Users/Ethan/Desktop/Projects/zhudatuan/main` 是唯一正式工程、Git 倉庫、構建與部署來源；同層的 `../archives/` 是築大團未來的歷史提詞庫與代碼找回庫。

- 需要舊版 VI／UI／UE、登入、會員權限、商品、訂單、支付、供應商、接口契約或部署經驗時，先在 `archives/` 搜尋。
- 找回時必須記錄來源路徑、Git commit／branch 與工作樹狀態，再判斷是否適合目前契約。
- 只提取本次需要的最小代碼與業務語義，重新接入 `main/` 並補測試；不得整包搬運。
- `archives/` 不是正式開發目錄、運行時依賴、現行契約真值或部署來源。
- 正式 `.git` 位於 `main/.git`；`archives/` 在該 Git 工作樹之外，因此不會被 GitHub、構建或部署誤收錄。

完整使用規則見 [`archives/README.md`](../../../archives/README.md)。

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

`../../../archives/smart-wing-20260826/Shop/pre-contract-code-merge-20260820/smart-wing-membership-permissions/apps/admin-web/src/components/workstations/MembershipPermissionWorkstation.tsx`

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
