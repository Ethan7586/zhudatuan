# AU-001｜历史取证

## 1. Playwright workspace 名称

- [FACT] `playwright.config.ts:37` 的五个名称由提交 `88a625c0f` 引入或最后归责，时间为 2026-08-27。
- [FACT] `auth-web/package.json` 的 `@smart-wing/auth-web` 名称可追溯到同日基线提交链；当前仓库全历史未发现 `apps/auth`、`apps/store`、`apps/supplier` 或 `apps/storefront` 的 package.json。
- [INFERENCE] 现有证据更支持“配置从建立时就与 workspace 图不一致”，而不是证明这些名称曾经有效。因此 F-0002 使用 FACT/CONFLICT，不使用 STALE 标签。

## 2. ESLint 路径

- [FACT] `eslint.config.mjs:8` 当前行由提交 `fe3269c8a` 在 2026-09-04 引入或最后归责。
- [FACT] 当前基线与历史路径检索均没有证明 `apps/auth`、`apps/storefront` 等目录是现行 React app。
- [INFERENCE] 不能把这组路径描述成“历史兼容”；它是当前质量配置与代码树不一致，详见 F-0003。

## 3. 使用限制

Git blame 和路径历史只解释来源，不证明当前运行行为。F-0002 的运行结论来自 npm 真实 workspace 解析，F-0003 的覆盖结论来自当前 flat config 与当前受控路径交叉核对。
