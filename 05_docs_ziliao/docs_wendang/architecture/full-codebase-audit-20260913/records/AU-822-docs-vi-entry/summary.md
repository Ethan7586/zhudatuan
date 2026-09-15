# AU-822｜资料区与 VI 入口

- 审阅范围：`05_docs_ziliao/README.md`、`05_docs_ziliao/VI_shijue/README.md` 与 `release-packages/ZHU-VI-1.5.zip` 的只读目录清单。
- `05_docs_ziliao/README.md` 的“非运行代码”边界与仓库事实一致；未发现构建、部署或运行时入口引用它。
- VI README 的 `current/` 正式标准说明不能被当成“仅文档”：Auth Web 已直接导入其中 SVG 和字体。历史版本、探索记录与发布包保留规则因此是可追溯性约束，不能用零源码引用推断可删。
- ZIP 为 2.0 MiB 的人工可交付发布包，目录含构建脚本、视觉资产、PDF 和预览；仅列目录，未解压、执行、重建或修改。归为 **GX**，后续若处理须以发布记录、实际使用方和可恢复性专项复核。
