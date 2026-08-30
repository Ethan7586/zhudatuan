# 主打團 VI 1.1 升級執行紀錄

建立時間：`2026-08-28 20:37:36 +08:00`（Asia/Shanghai）  
版本：`1.1.0`  
狀態：Upgrade Draft  
Owner：Ethan

## 目標

把目前只存在於智慧翼 Console refinement 的視覺成熟度，沉澱回 `@shop/design`，形成可被 Console、Auth、Storefront 和移動端共同使用的主打團產品設計系統升級稿。

## 本輪實作

1. Canonical Token 從 `1.0.0` 升到 `1.1.0`，新增：
   - Surface、Info、Focus、Scrim。
   - Typography weight／tracking／amount。
   - 多層 Depth Shadow 與 z-index Layer。
   - Icon、Control、Layout、Motion 細則。
2. 擴充 Web Token Generator，讓新增內容生成為 CSS Variables 與 TypeScript Token。
3. 新增設計原語：
   - `Surface`
   - `Divider`
   - `Icon`
   - `IconButton`
   - `Badge`
4. 擴充 `Button`：四種 Tone、三種 Size、Icon-only、Pending 語義。
5. 新增 Foundation／Controls／Data Display／Feedback 樣式層。
6. 新增完整 Storybook 設計板與 Primitive Test。
7. 建立 VI 1.1 完整規範、Changelog 與本執行紀錄。
8. `components.css` 維持 opt-in，只在 Storybook 載入；正式 Console 的 `workspace.css` 不自動引入升級稿。

## 明確未做

- 未修改 `apps/console/src/smart-wing-vi.css`。
- 未修改 `apps/console/src/legacy-admin-theme.css`。
- 未修改正式 Console 仍在使用的 legacy `packages/design/src/command.css` Dialog；VI 1.1 已定義 Layer 70／80 與 Modal Shadow，接入列為 `VI-006` 待遷移。
- 未更新 Owner-approved UI Hash。
- 未把 Auth／Storefront 強制切換到新 Canonical Token。
- 未更改智慧翼 Logo、名稱、主色、翼碼或主導航。

原因：本輪是可預覽、可驗證、可回退的升級稿；正式 Console 外觀只能在 Owner 確認後替換。

## 回退邊界

生產應用尚未接入新 Primitive，因此回退只需撤銷：

```text
packages/design 1.1.0 新增內容
Storybook VI 1.1 Story
docs/brand/ZHUDATUAN-DESIGN-SYSTEM-VI-1.1.md
```

既有 Console、Auth、Storefront 仍保有原 Theme，不需資料或 API 回退。

## 驗證命令

```bash
node scripts/build-web-tokens.mjs
node scripts/build-web-tokens.mjs --check
npm run typecheck --workspace @shop/design
npm run test:component --workspace @shop/design
npm run storybook:build --workspace @shop/design -- --output-dir <temporary-directory>
npm run build:console
```

根層 `npm run generate:design` 仍包含已失去 `apps/miniapp` 目標的舊小程序生成步驟，因此本輪只驗證 Web Canonical Generator，不把該失效命令列為通過項。

## 驗證結果

- Web Token 生成與 stale check：通過。
- `@shop/design` TypeScript：通過。
- Unit：5 files／19 tests 通過。
- Component：4 files／21 tests 通過。
- Storybook static build：通過。
- Console production build：通過。
- Owner-approved UI：3 surfaces／60 locked files Hash 通過。
- Browser：桌面與 390×844 手機均有內容、無 Error Overlay、無 Console Error。
- A11y：桌面與手機 axe WCAG A／AA `violations = 0`。
- Keyboard：Tabs ArrowLeft／ArrowRight、roving focus、IconButton Tooltip 通過。
- Responsive：頁面無水平 overflow；窄屏表格使用可聚焦橫向 Scroll Region。
- Line Budget：本輪新增 source 全部低於 299 行；全倉檢查仍被 11 個既有超長文件阻擋。

證據：[桌面與手機驗證](../evidence/vi/2026-08-28/README.md)；批准候選總板：[PNG](../brand/design-previews/zhudatuan-design-system-vi-1.1.png)。

## 待 Owner 確認

1. Shadow 四級是否符合預期精緻度。
2. Button 40px Default 與 36px Compact 的 Console 密度。
3. 2px Icon Stroke 與七檔尺寸。
4. Divider 強度與表格行高。
5. 品牌 Hero 是否僅用於高價值入口。
6. 確認後是否進入 Console Token 化遷移。
