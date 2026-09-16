# AU-782｜展示层边界检查器

- 审阅范围：`check/brand-language.mjs`、`check/browser-brand-language.mjs`、`check/bundles.mjs`、`check/frontend.mjs`。
- 审阅方式：深读源码品牌扫描、真实浏览器检查、构建制品预算与前端 token/routing/import 边界；同构 filesystem walk、finding aggregation 和 CLI 退出骨架作结构性覆盖。
- 验证：brand-language 在固定基线报140项；frontend 报13项新增/33项既有债务；bundles 因本审计工作树无 `dist` 仅报四个缺失制品；browser-brand-language 要求显式真实 URL，本批未启动服务或访问线上，故未验证。

## 审计结论

- **G0：全部保留。** 四者分别约束静态品牌字样、浏览器可见文本/console errors、实际构建产物大小和不应进入制品的内容、前端 token/routing/public feature entry。
- **既有结论复证：** `check/frontend.mjs` 的13项与 F-0008 完全一致；brand-language 的 canonical design SVG/Brand 与多端静态遗留字样复证 F-0080。静态命中不自动证明页面实际可见，因此不把140项升级为新问题。
- **未验证：** bundle 检查只有构建产物存在时才有意义；browser scanner 需要指定受控 URL，并可在可选目录写截图。本审计未生成制品、未启动服务、未写截图，不能把这两类结果写成通过或失败。
