# AU-800｜调用图共享解析器与投影检查器

- 审阅范围：共享 `source.mjs`（231 行）及同构 `callgraph/{database,extensions,routes}.mjs`（25/119/34 行）。
- 审阅方式：共享源码发现、TypeScript import 解析、入口推导与三个投影的差异断言均已阅读；运行正式总入口与其无副作用 self-test。投影文件按同构规则核对差异，不重复全文深读共用 catalog/parser 模式。

## 审计结论

- **F-0304 / P2（复现，未重复登记）：** `calls.mjs` 仍输出679项并退出1；共享 source 根是当前 `01_core_hexin/...`，但总门禁的入口/retired 判断仍使用重组前顶层假设。database 的字符串 caller 绑定、extensions 的静态 provider 文件集合和 routes 的文件名启发式均被同一不可判读总输出遮蔽。
- 总入口 `--self-test` 通过，只覆盖临时 import/route fixture，不证明真实仓库路径分类；不将其写成总调用图通过。
- 四个文件均由 `check:calls` 直接加载，是 **G0**；没有自动删除依据。

## 验证边界

- 已运行：`node 04_tools/scripts/check/calls.mjs`（679项、exit 1）及 `--self-test`（通过）。
- 未运行任何服务、数据库或运行时路由；catalog caller 字符串、provider registry 和 app route 的真实生产可达性保持“未由本静态门禁证明”。
