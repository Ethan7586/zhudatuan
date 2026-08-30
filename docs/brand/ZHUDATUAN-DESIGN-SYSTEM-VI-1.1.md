# 主打團 Product Design System｜智慧翼 VI 1.1 升級稿

狀態：**Upgrade Draft（工程升級稿，未替換正式 Console）**  
版本：`1.1.0`  
制定時間：`2026-08-28 20:37:36 +08:00`（Asia/Shanghai）  
Owner：Ethan  
品牌基線：Smart Wing VI `1.0.0`  
Canonical Package：`@shop/design`  
適用範圍：Console、Auth、Storefront、微信小程序及後續原生端

---

## 0. 文件裁決

本文件把已在智慧翼 Console 中驗證過的精緻度，整理成主打團可持續使用的產品設計系統。它補齊陰影、圖層、Icon、Button、分割線、狀態、密度與組件規則，不改動下列 Smart Wing VI 1.0 凍結項：

1. 智慧翼／Smart Wing 名稱與 W/翼形 Logo。
2. 智慧藍 `#1F5EFF`、深海藍 `#143A8F`、夜空墨 `#07182F`。
3. 品牌主張、翼碼、五欄主導航及三級品牌關係。
4. 既有業務語義、權限模型、API、資料與審計邊界。

因此本次是向後相容的 `1.1.0` 升級，而不是重新品牌。若未來改名稱、Logo、主色、字體身份、翼碼或主導航，必須建立 `2.0.0`，不得混入本稿。

## 1. 權威來源與工程路徑

唯一真值：

```text
packages/design/src/tokens.json
packages/design/src/mobile-platforms.json
packages/design/src/brand/*.svg
```

生成物，禁止手改：

```text
packages/design/src/tokens.css
packages/design/src/Token.ts
```

目前正式倉庫沒有 `apps/miniapp`，所以本稿不宣稱不存在的小程序生成物已完成；恢復小程序 Target 後，才重新接通 `build-miniapp-theme.mjs`。

組件與樣式：

```text
packages/design/src/components.css
packages/design/src/foundation.css
packages/design/src/controls.css
packages/design/src/data-display.css
packages/design/src/feedback.css
packages/design/src/*.tsx
```

設計板：`VI 1.1 升級稿/完整設計板` Storybook Story。

批准候選總板：[zhudatuan-design-system-vi-1.1.png](./design-previews/zhudatuan-design-system-vi-1.1.png)；驗證紀錄：[2026-08-28 VI Evidence](../evidence/vi/2026-08-28/README.md)。

`packages/design-system` 是遷移殘留，不得新增令牌或組件。Auth／Storefront 仍引用舊包，列入遷移但不在未驗收前直接切換。

## 2. 設計原則

### 2.1 品牌清楚，業務優先

- 品牌藍負責識別、主操作、選中與焦點。
- 成功、警告、危險只表達狀態，不用作裝飾。
- AI 不建立紫色副品牌，以智慧藍及可解釋文案表達。

### 2.2 描邊先於陰影

- 普通內容卡片使用 `1px` 邊框，不靠重陰影分組。
- 只有離開文檔流、會遮擋其他內容或需要操作聚焦的面才提高陰影。
- 同一畫面最多出現三個可感知深度：Canvas、Surface、Overlay。

### 2.3 留白先於分割線

- 先使用 8／12／16／24px 間距表達關係。
- 關係仍不清楚才增加 Divider。
- 禁止一個卡片同時使用粗邊框、重陰影和背景色三重分隔。

### 2.4 狀態必須完整

所有可互動組件都要覆蓋：

`default / hover / pressed / focus-visible / selected / loading / disabled / invalid / destructive`

所有資料組件都要覆蓋：

`loading / empty / ready / refreshing / stale / denied / notfound / conflict / ratelimited / offline / failure / retry`

### 2.5 安全邊界可見

高風險操作必須把 Scope、對象、原因、版本、Step-up 與操作結果放在可見流程中；不能把安全機制只藏在 API。

## 3. 色彩系統

### 3.1 品牌色

| Token                | 值        | 用途                          |
| -------------------- | --------- | ----------------------------- |
| `--sw-brand`         | `#1F5EFF` | Primary、焦點、選中、品牌識別 |
| `--sw-brand-hover`   | `#174ED1` | Primary hover                 |
| `--sw-brand-pressed` | `#123FAF` | Primary pressed               |
| `--sw-brand-dark`    | `#143A8F` | 文字連結、深色漸變            |
| `--sw-brand-ink`     | `#07182F` | Sidebar、Tooltip、深色底      |
| `--sw-brand-light`   | `#EAF1FF` | Selected、Info surface        |
| `--sw-brand-faint`   | `#F4F7FF` | Hover 與極淡品牌面            |

禁止新增近似品牌藍。需要亮度差時使用已有狀態 token，不自行調 hex。

### 3.2 表面與文字

| 層級     | Token                   | 規則                 |
| -------- | ----------------------- | -------------------- |
| Canvas   | `--sw-background`       | 全頁底色，不承擔互動 |
| Surface  | `--sw-surface`          | 卡片、表格、控制面   |
| Subtle   | `--sw-surface-subtle`   | 表頭、次級分組       |
| Sunken   | `--sw-surface-sunken`   | 內嵌區、Skeleton 底  |
| Hover    | `--sw-surface-hover`    | 中性 hover           |
| Selected | `--sw-surface-selected` | 選中行／範圍         |
| Disabled | `--sw-surface-disabled` | 禁用控制面           |

正文只使用 `--sw-text`、`--sw-text-secondary`、`--sw-muted`、`--sw-disabled` 四級。反白文字只使用 `--sw-surface` 或正式 inverse token。

### 3.3 語義色

| 語義    | 實色           | Strong                | Surface                |
| ------- | -------------- | --------------------- | ---------------------- |
| Info    | `--sw-info`    | `--sw-info-strong`    | `--sw-info-surface`    |
| Success | `--sw-success` | `--sw-success-strong` | `--sw-success-surface` |
| Warning | `--sw-warning` | `--sw-warning-strong` | `--sw-warning-surface` |
| Danger  | `--sw-danger`  | `--sw-danger-strong`  | `--sw-danger-surface`  |

Surface 上的文字與 Icon 使用 Strong；實色主要用於狀態點、左邊線、Icon 或邊框。狀態不得只靠顏色，至少同時提供 Icon 或文字。

### 3.4 遮罩與玻璃

- 一般 Overlay：`--sw-overlay-scrim`，`rgba(7,24,47,.58)`。
- 高風險不可穿透 Overlay：`--sw-overlay-scrim-strong`。
- Header 玻璃面：`--sw-overlay-glass`，只用於已有內容滾動穿過的固定層。
- Blur 不得單獨出現；必須同時有半透明 Surface、Border 和明確 z-index。

## 4. 字體、數字與排版

| 樣式        | Size / Line | Weight | 用途                    |
| ----------- | ----------- | ------ | ----------------------- |
| Display     | 32 / 40     | 700    | 大型總覽數字、宣告標題  |
| H1          | 28 / 36     | 700    | 路由主標題              |
| H2          | 20 / 28     | 600    | 區塊標題                |
| H3          | 17 / 24     | 600    | 卡片標題                |
| Body        | 16 / 24     | 400    | 正文                    |
| Body Small  | 14 / 20     | 400    | 表格、操作說明          |
| Label       | 14 / 20     | 600    | 控件主標籤              |
| Label Small | 12 / 16     | 600    | Compact 控件、Badge     |
| Caption     | 12 / 18     | 400    | 輔助說明最低層級        |
| Overline    | 12 / 16     | 700    | 英文 Eyebrow，`0.095em` |
| Amount      | 20／28／32  | 700    | 金額、KPI，tabular nums |

規則：

1. 正式 UI 字號不得小於 12px。
2. 字重只用 400／500／600／700，不使用 800／900 製造層級。
3. 中文不做全大寫；英文 Overline 可大寫。
4. 金額永不換行、永不省略、永不縮字；相鄰元素先讓位。
5. ID、版本、Request ID 使用 Mono；金額與 KPI 使用 Financial family。
6. 標題最多兩行；導航標題單行且不省略。

## 5. 網格、間距、密度與響應

基礎網格為 8px，允許 4px 半步。正式間距：`0 / 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64`。

### 5.1 密度

- Compact：控制面 36px，只用於桌面高密度工具列。
- Default：40px，Console 預設。
- Large：48px，主要 CTA、Auth、移動端。
- 移動端最小觸控面 44pt（Android 48dp）；Compact 視覺高度不得直接搬到移動端。

### 5.2 Layout

| Token                     |     值 | 用途               |
| ------------------------- | -----: | ------------------ |
| `--sw-layout-content-max` | 1440px | Console 最大內容寬 |
| `--sw-layout-reading-max` |  960px | 表單／文檔閱讀寬   |
| `--sw-layout-sidebar`     |  220px | Desktop Sidebar    |
| `--sw-layout-header`      |   56px | Header             |
| `--sw-layout-scopebar`    |   40px | Scope Bar          |
| `--sw-layout-footer`      |   36px | Footer             |

Breakpoint：640／768／1024／1280／1536。頁面本身禁止橫向滾動；表格或 Chips 應有自己的橫向容器。

## 6. 圓角、邊框與分割線

### 6.1 圓角

- 8px：小 Badge、Tooltip、緊湊內容。
- 12px：Button、Input、Menu、一般 Panel。
- 16px：主卡片、路由面板、Dialog。
- 24px：品牌 Hero、移動端大型容器。
- Full：Avatar、狀態點、真正的圓形或膠囊。

禁止 5、6、9、10、11、14、18、20px 等頁面私有圓角。

### 6.2 邊框

- Hairline：1px，普通 Surface 與控制面。
- Strong：2px，選中、警告左邊線、不可忽略的結構。
- Focus：3px Ring，不改 Layout。

### 6.3 Divider

- `subtle`：同一容器內的弱分組。
- `default`：表格行、卡片區塊。
- `strong`：Header／Footer、Sticky 區。
- `inverse`：深色 Surface。
- `content inset`：避開卡片水平 padding。
- `icon inset`：從 Icon 容器之後開始。

垂直 Divider 只用於同一工具列的平級操作，不用於主要兩欄 Layout。

## 7. 陰影、深度與圖層

### 7.1 陰影階梯

| 深度          | Token                        | 使用                            |
| ------------- | ---------------------------- | ------------------------------- |
| Flat          | `none`                       | Canvas 上的平面區塊             |
| Low           | `--sw-shadow-surface-low`    | 普通卡片；應同時保留 Border     |
| Raised        | `--sw-shadow-surface-raised` | Dropdown、Popover、Hover Lift   |
| Floating      | `--sw-shadow-floating`       | Drawer、Toast、Command Palette  |
| Modal         | `--sw-shadow-modal`          | Modal；必須有 Scrim             |
| Brand Control | `--sw-shadow-brand-control`  | Primary CTA，禁止擴散到普通卡片 |
| Focus         | `--sw-shadow-focus`          | Focus-visible                   |
| Focus Danger  | `--sw-shadow-focus-danger`   | Invalid／Danger focus           |
| Pressed       | `--sw-shadow-pressed`        | Pressed inset                   |

陰影不可用於：表格每一行、Badge、普通 Divider、靜態文字區、所有同級卡片同時浮起。

### 7.2 z-index 合約

| Layer             | z-index |
| ----------------- | ------: |
| Base              |       0 |
| Raised            |      10 |
| Sticky            |      20 |
| Header            |      30 |
| Dropdown          |      40 |
| Popover / Tooltip |      50 |
| Drawer            |      60 |
| Overlay           |      70 |
| Modal             |      80 |
| Toast             |      90 |
| Command Palette   |     100 |

組件不得自創 `999`、`9999`。需要更高層時先修改 Layer 合約並說明遮擋關係。

## 8. Logo、Icon 與 Avatar

### 8.1 Logo

沿用 VI 1.0 的母版、安全區與不可改色規則。Logo 不使用陰影作常規裝飾；只有深色 Sidebar 的 44px 品牌標記可使用受控 Brand Shadow。

### 8.2 Icon

- 統一 24×24 viewBox。
- 標準描邊 2px、Fine 1.75px、Strong 2.25px。
- `round` linecap 與 linejoin。
- 尺寸：12／16／20／24／28／32／40。
- Icon Container：28／32／40／48。
- Button 內一般用 16px；欄目導航用 20px；空狀態用 32px；Hero 才用 40px。
- 同一工具列不得混用線性、填充、Emoji 與不同描邊風格。
- 純 Icon Button 必須有 `aria-label` 和 Tooltip／title。
- 裝飾 Icon `aria-hidden=true`；獨立傳意 Icon 使用 `role=img` 與可讀名稱。

### 8.3 Avatar

24／32／40／48px，必須為圓形。無照片時用名字第一個可讀字符，不用隨機 Emoji。狀態點不得遮住超過 Avatar 直徑 25%。

## 9. Button

### 9.1 類型

- Primary：每個 Surface 建議只有一個；執行主要前進動作。
- Default：一般操作。
- Quiet：取消、工具列次級操作；沒有常駐 Border。
- Danger：刪除、移除、停用等破壞性操作。
- Icon Button：只放一個 Icon；必須有可讀名稱。

### 9.2 尺寸

| Size    | 高度 | Inline Padding | Gap | Font      |
| ------- | ---: | -------------: | --: | --------- |
| Compact |   36 |             12 |   6 | 12/16 600 |
| Default |   40 |             14 |   8 | 12/16 600 |
| Large   |   48 |             18 |  10 | 14/20 600 |

### 9.3 狀態

- Hover：提升 Border 或 Tint，可上移 1px；Reduced Motion 不位移。
- Pressed：恢復 y=0，使用 Inset Shadow。
- Focus-visible：3px Ring；Mouse click 不強制顯示。
- Loading：保留原寬，`aria-busy=true`，禁止重複提交。
- Disabled：不透明度不低到不可讀；使用 Disabled Surface/Text，不回應 Hover。
- Danger focus：使用 Danger Ring。

禁用 Primary 不得保留高飽和漸變。Button 文案用動詞＋對象，例如「保存角色」「移除成員」，不用「確定」。

## 10. Form Controls

適用 Input、Textarea、Select、Search、Checkbox、Radio、Switch。

1. Label 永遠在值之前；Placeholder 不代替 Label。
2. Default 高 40px、Radius 12px、Border Interactive。
3. Helper 與 Error 均為 12/18；Error 同時提供圖標或明確文字。
4. Hover 只提高 Border；Focus 使用 Ring，不改尺寸。
5. Disabled 保留可讀值，不能只靠 `opacity:.3`。
6. Checkbox／Radio 可視圖形至少 16px，整個 Label 行可點。
7. Switch 只表達立即生效的二元狀態；需要保存時改用 Checkbox/Form。
8. Search 有清除按鈕、可讀名稱及 Escape 行為。
9. 金額、日期、手機、ID 使用明確格式與輸入提示。

## 11. Navigation

### 11.1 Sidebar

- 深海藍至夜空墨漸變，寬 220px。
- 項目高不低於 40px，Radius 8px。
- Hover 使用 6% inverse tint；Selected 使用品牌藍 24% tint＋2px 左側指示線。
- Selected Icon 與文字同時變化，不只靠背景。
- Sidebar Shadow 只存在於 Desktop 邊界；窄屏 off-canvas 使用 Overlay。

### 11.2 Header / Scope Bar

- Header 56px，Scope Bar 40px。
- Header 在內容滾動穿過時才使用 Glass/Blur。
- Scope、AAL、資料時間與工作週期是狀態，不應偽裝成主要按鈕。

### 11.3 Tabs、Breadcrumb、Pagination

- Tabs 用 2px 底線＋文字變化；不使用膠囊包住所有分頁。
- Breadcrumb 顯示層級，不顯示完整資料庫 ID。
- Pagination 必須有 disabled、current 與總數，Icon Button 需有名稱。

## 12. Card、Panel、List、Table、Badge

### 12.1 Card / Panel

- 普通 Card：Border + Radius 16 + Low Shadow。
- 內部 Panel：Border + Radius 12，不疊加陰影。
- Hero：可用 Radius 16/24 與受控品牌背景，但正文保持可讀對比。
- 卡片 Header、Body、Footer 以 Divider 或留白分組，不同時使用。

### 12.2 Table

- 表頭 12/16 600，資料 14/20。
- 行高 48px；Compact 40px 只用於 Desktop。
- Hover 使用 Neutral Hover；Selected 使用 Brand Selected，不增加陰影。
- Sticky Header 的 Layer 為 Sticky 20。
- 金額右對齊、文字左對齊、狀態與操作維持固定欄。
- 空表格顯示 Empty State，不留下只有表頭的空框。

### 12.3 Badge / Tag

- Badge 是只讀狀態摘要；Tag 是可移除或可篩選對象，兩者不可混用。
- 最小高 24px、Radius Full、12/16 600。
- 數字大於 99 顯示 `99+`。
- Danger Badge 不作按鈕；破壞性操作使用 Danger Button。

## 13. Dialog、Drawer、Popover、Tooltip、Toast

### 13.1 Dialog

- Modal Layer 80，Overlay 70，Modal Shadow。
- Header Sticky；標題、描述、Close 都有穩定位置。
- 寬度：Small 440、Default 640、Large 832；不使用任意寬。
- Footer 右對齊，Primary 在最右；Danger 流程 Primary 可改為 Danger。
- 關閉後焦點回到觸發點。

### 13.2 Drawer

- 用於保留列表上下文的詳情或複雜操作。
- Desktop 寬 480／640；Mobile 佔滿。
- Drawer 不是 Modal 的替代品：需要完整注意力與阻斷時使用 Dialog。

### 13.3 Popover / Menu / Tooltip

- Popover Layer 50、Raised Shadow、Radius 12。
- Menu 行高 40px，Selected、Disabled、Danger 分離。
- Tooltip 只補充短說明，不承載必讀安全信息；深色底、Radius 8、最大 288px。

### 13.4 Toast

- Layer 90，顯示操作結果；不取代頁內 Error。
- Success 可自動消失；Danger／需後續處理的 Toast 保留操作入口。
- 同時最多三個，新的排在可預測方向。

## 14. Feedback 與資料狀態

任何完整狀態由四部分構成：Icon、標題、原因、下一步。

- Loading：首次讀取，使用 Skeleton，避免整頁 Spinner。
- Refreshing：保留舊資料並顯示局部更新。
- Stale：明確標示最近成功時間，未刷新前關閉寫入。
- Empty：說明為什麼空，若可解決提供唯一 CTA。
- Denied：顯示 Scope／所需權限／申請路徑，不洩漏敏感資料。
- Conflict：顯示版本衝突並要求重讀，不能盲目覆蓋。
- Offline：保留最近資料但標示不可提交。
- Failure：使用 Error Code／Request ID，禁止只顯示「出錯了」。

Skeleton 動效 1.5s；Reduced Motion 時停止位移。Spinner 只用於小區域與按鈕。

## 15. Shell 與工作區骨架

Desktop 結構：

```text
Sidebar 220
└─ Brand / Navigation / Profile

Workspace
├─ Header 56
├─ Scope Bar 40
├─ Route Content max 1440
└─ Footer 36
```

規則：

1. Sidebar、Header、Scope Bar、Footer 是全局唯一實現。
2. Feature 不得重造頂欄、Scope 選擇器或帳戶菜單。
3. 路由內容先使用 Canonical Surface／Panel，不新增 Feature 私有陰影。
4. ≤1024px 導航收起；≤768px 使用 off-canvas；Content Padding 降為 16px。
5. 200% Zoom 時可完成所有任務，不能因固定高寬裁切操作。

## 16. 權限與高風險操作

本設計系統特別規範權限操作：

1. 個人身份／角色與商品、商城、門店等實體範圍分開展示。
2. Allow 與 Deny 分區；Deny 明確標示優先級。
3. Owner 保護不可只用 Disabled Button，需說明原因。
4. 變更前顯示 Preview Diff：新增、移除、Deny、Scope、到期時間。
5. 高風險操作要求 Step-up。
6. 提交帶 `expectedVersion`；衝突後必須重讀。
7. 完成後顯示 Access Version 與審計回執。
8. 變更原因是必填業務資料，不是 Placeholder。

缺少 Preview、Step-up、expectedVersion 或重讀回執任一項，寫入保持關閉。

## 17. Motion 與交互

| Token      |  時間 | 用途                     |
| ---------- | ----: | ------------------------ |
| Instant    |   0ms | Reduced Motion、立即狀態 |
| Micro      |  80ms | Icon、Pressed            |
| Fast       | 120ms | Hover、Focus、Border     |
| Standard   | 200ms | 選中、Popover            |
| Slow       | 320ms | Drawer、頁內重排         |
| Deliberate | 480ms | 大型狀態轉換，慎用       |

- Standard easing：一般狀態。
- Enter easing：進入與浮起。
- Exit easing：退出，應比進入更直接。
- 禁止無目的循環、彈跳、呼吸燈。
- Reduced Motion 停止位移、縮放、Skeleton shimmer；保留必要顏色變化。

## 18. 文案、日期、金額與 ID

- 操作：動詞＋對象，「保存角色」「刷新資料」「移除成員」。
- 狀態：名詞或完成式，「待審核」「已失效」「資料過期」。
- 日期：界面 `2026-08-28 20:37`；API 保持 ISO 8601。
- 金額：`¥ 18,425,000.00`；負數使用 `−` 並保留語義色。
- 版本：`v12` 或 `Access Version 12`，同一頁統一。
- ID：主畫面展示可讀名稱；完整 ID 放詳情、Copy 或審計區。
- 錯誤：用可讀原因＋穩定 Error Code，不顯示技術 Stack。

## 19. Accessibility

1. 正文、控制面與狀態達 WCAG AA。
2. 所有互動可用鍵盤完成；Tab 順序符合視覺順序。
3. Focus-visible 不得被 `outline:none` 無替代地移除。
4. Icon Button、Avatar Menu、Pagination、Close 必須有可讀名稱。
5. Dialog 開啟時管理焦點，關閉後恢復焦點。
6. 狀態不只靠顏色；圖表提供文字摘要。
7. 200% Zoom 不裁切；Mobile 支援安全區與動態字體。
8. `prefers-reduced-motion`、`prefers-color-scheme` 有正式處理。
9. Touch Target：iOS 44pt、Android 48dp、小程序 88rpx。
10. Tooltip 內容不可成為完成任務的唯一信息。

## 20. 平台映射

同一品牌、同一業務、平台原生：

- Web／Console：CSS Variables + React Aria。
- Auth：Large controls、單欄閱讀寬、明確錯誤與安全狀態。
- Storefront：保留商業密度，但不引入第二品牌色。
- 微信小程序：rpx 生成物、膠囊與安全區、翼碼中央結構。
- iOS／Android：遵守原生返回、Dynamic Type／Material 3 與觸感反饋。

視覺可以按平台有意適配，但 Token 語義、文案、狀態與業務順序不能分叉。

## 21. 遷移策略

### Phase 1：本稿（已建立）

- 升級 Canonical Token 到 `1.1.0`。
- 增加 Component CSS、Surface、Divider、Icon、IconButton、Badge。
- 建立完整 Storybook 設計板。
- `components.css` 採明確 opt-in；目前只由 Storybook 載入，不注入正式 Console cascade。
- 不修改 Owner-approved Console Theme。

### Phase 2：Owner 視覺確認

- 在同一視口對照 Console 現狀與 Storybook。
- 凍結 Token、Shadow、Control、Icon、Divider。
- 將狀態改為正式基線並記錄 Owner 確認時間。

### Phase 3：逐端遷移

1. Console：把 `--vi-*` 與成熟樣式逐項改為 `--sw-*`／`@shop/design`。
2. Auth：從舊 `packages/design-system` 切到 Canonical。
3. Storefront：同上，並用 baseline 逐步清理硬編碼。
4. 移除 legacy design-system 與重複 Icon registry。

### Phase 4：守門

- 生成物一致性。
- 禁止新硬編碼色、陰影、z-index、非標準圓角與小字。
- 每個組件維持 Story、A11y、Keyboard 與視覺證據。

## 22. 遷移台帳格式

| ID     | 層／組件          | 現有來源                   | Canonical 目標              | 變更類型     | 風險 | 回退            | 證據       | 狀態   |
| ------ | ----------------- | -------------------------- | --------------------------- | ------------ | ---- | --------------- | ---------- | ------ |
| VI-001 | Console Shadow    | `smart-wing-vi.css`        | `--sw-shadow-*`             | Token 化     | 中   | 保留舊 Theme    | Story/截圖 | 已實作 |
| VI-002 | Button            | Console 私有 `.shopbutton` | `@shop/design/Button`       | 組件收斂     | 中   | CSS Layer 回退  | Story/Test | 已實作 |
| VI-003 | Icon              | 多份 registry              | `@shop/design/Icon`         | 組件收斂     | 中   | 逐頁回退        | Story/A11y | 已定義 |
| VI-004 | Auth Tokens       | legacy design-system       | `packages/design`           | Truth Source | 中   | 保留舊 import   | Build/截圖 | 待盤點 |
| VI-005 | Storefront Tokens | legacy design-system       | `packages/design`           | Truth Source | 高   | Baseline 回退   | Build/旅程 | 待盤點 |
| VI-006 | Dialog／Overlay   | `command.css` legacy       | Layer 70／80 + Modal Shadow | Layer 收斂   | 中   | 保留現有 Dialog | Story/A11y | 待遷移 |

狀態固定：`待盤點 → 已定義 → 已實作 → 已驗證 → Owner 確認`。

## 23. 驗收清單

- [x] `tokens.json` 與 `@shop/design` 版本為 `1.1.0`。
- [x] `tokens.css`、`Token.ts` 由生成器產生。
- [x] Shadow、Layer、Icon、Control、Divider 有 Canonical Token。
- [x] Button／IconButton／Surface／Divider／Badge 有實作與 Story。
- [x] 有完整日期、版本、Owner 與回退邊界。
- [ ] Owner 確認設計板。
- [ ] Console／Auth／Storefront 同視口前後截圖。
- [ ] Dark Mode 組件驗收。
- [ ] 200% Zoom、Keyboard、讀屏與 Reduced Motion 全量驗收。
- [ ] 三端切到同一 Canonical Package。
- [ ] 移除 `--vi-*`、`--legacy-*` 與 `packages/design-system`。

## 24. 升級稿凍結線

在 Owner 確認前：

- 本稿是可執行的升級候選，不是正式替換令。
- 不修改 `config/owner-approved-ui.json` 所鎖定的 Console 外觀。
- 不在 Feature CSS 增加新的品牌常量。
- 可繼續補 Story、測試、平台映射與遷移證據。

Owner 確認後，建立確認日期與 Hash，狀態才從 `Upgrade Draft` 轉為 `Formal Baseline`。
