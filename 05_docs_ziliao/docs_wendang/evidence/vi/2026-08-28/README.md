# 主打團 VI 1.1 驗證證據

驗證日期：`2026-08-28`（Asia/Shanghai）  
對象：`VI 1.1 升級稿/完整設計板`  
版本：`@shop/design 1.1.0`  
狀態：Upgrade Draft

## 視覺證據

- [Desktop 1440×1000](./zhudatuan-vi-1.1-desktop.png)
- [Mobile 390×844](./zhudatuan-vi-1.1-mobile.png)
- [批准候選總板](../../../brand/design-previews/zhudatuan-design-system-vi-1.1.png)

## Browser Verification

| 項目                         | Desktop | Mobile                   |
| ---------------------------- | ------- | ------------------------ |
| Meaningful content           | PASS    | PASS                     |
| Error overlay                | 0       | 0                        |
| Console／page error          | 0       | 0                        |
| axe WCAG A／AA violations    | 0       | 0                        |
| Body horizontal overflow     | 0       | 0                        |
| Table narrow-screen handling | N/A     | 可聚焦橫向 Scroll Region |

互動驗證：

- Tabs 支援 ArrowLeft／ArrowRight、roving `tabIndex`，選中態、Focus 與 `tabpanel` label 同步。
- IconButton 有可讀 `aria-label`；鍵盤 Focus 後 Tooltip 與 `aria-describedby` 正常出現。
- Invalid Input 的錯誤訊息透過 `aria-describedby` 關聯。
- Skeleton 對讀屏隱藏，只保留單一 Loading Status。

## Build Verification

```text
Web token artifacts          PASS
@shop/design typecheck       PASS
Unit tests                   5 files / 19 tests PASS
Component tests              4 files / 21 tests PASS
Storybook static build       PASS
Console production build     PASS
Owner-approved UI manifest   3 surfaces / 60 files PASS
```

## 已知未完成

- Upgrade Draft 尚待 Owner 視覺確認。
- Dark Mode、200% Zoom、全量讀屏旅程及跨端遷移尚未完成。
- Legacy Dialog 仍使用 `command.css` 舊 Layer；已列 `VI-006` 待遷移。
- 根層 `generate:design` 的小程序分支因 `apps/miniapp` 不存在而失效；Web Generator 已獨立驗證。
- 全倉 `check:lines` 仍受 11 個既有超長文件阻擋，本輪新增 source 無超限。
