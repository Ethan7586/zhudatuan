# zhudatuan VI

这里是 `zdt-next` 的视觉识别（VI）统一入口。

## 当前正式标准

- `current/ZHU-VI-1.5/`：当前产品、品牌和视觉资产的唯一正式标准。

## 版本升级记录

- `version-upgrades/ZHU-VI-1.2/`：早期组件、页面预览和视觉基线。
- `version-upgrades/ZHU-VI-1.3/`：中文排版、字体和跨平台视觉基线。
- `version-upgrades/ZHU-VI-1.4/`：主打团 Logo 定稿候选阶段。
- `version-upgrades/ZHU-VI-1.4-explorations/`：从 1.4 向 MORVIA 视觉体系升级时的完整探索记录，包含 Claude、Codex 和后续方向稿。

版本演进顺序：`1.2 -> 1.3 -> 1.4 -> 1.4 explorations -> 1.5`。

## 发布包

- `release-packages/ZHU-VI-1.5.zip`：VI 1.5 的发布压缩包。

## 整理规则

1. 产品实现只以 `current/` 中的正式版本为准。
2. 发布新版本时，先把原正式版本完整移入 `version-upgrades/`，再更新 `current/`。
3. 历史版本和探索记录只归档，不删除、不覆盖。
4. 可交付压缩包统一放入 `release-packages/`，不散落在仓库根目录。
