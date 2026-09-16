# RV-0070｜Console release build 编排独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；仅静态审阅，未构建、复制制品或启动浏览器。
- 对象：`04_tools/scripts/release/build-console.mjs`（56 行），对应 DC-0092 / GX-0050。

## 入口与边界

- 当前发布配置和 staging prepare 使用 `npm run build:console`；该命令直接构建 `@shop/console`，并不调用本脚本。`build-console.mjs` 是显式传入外部输出目录的人工 release 编排工具，仓内没有自动 workflow 调用它。
- 脚本拒绝缺失、已存在或位于 worktree 内的输出目录；构建前后都要求完整 git 工作区干净，固定 40 位 HEAD SHA、`SHOP_BUILD_DIRTY=false` 与 production 客户端版本。
- 构建完成后先校验 worktree 内 `dist` 的 commit/clean 制品信息，再复制到外部目录；随后调用 `verify-console.mjs` 浏览器验证，最后重读外部制品并输出不可变摘要。任何构建或验证失败都会阻止该工具成功结束。

## 结论

- **GX 维持，不得删除或执行。** 常规构建与该工具的额外封板职责不同：后者把干净工作区、固定 SHA、外部制品隔离与浏览器验收串成可交接证据链。无自动调用只能证明它是人工 release 工具，不能证明无运行责任。
- 本审计未验证浏览器脚本对真实身份、后端授权或线上可达性的覆盖，也未验证外部输出目录的保留、失败清理和正式发布控制面是否仍以此工具为准。
- 任何替换或退役必须在最新主线另建发布治理批次，由 Release Owner 逐项核验制品来源、失败恢复、摘要链和回滚路径；审计分支不得构建、发布或部署。
