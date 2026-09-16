# AU-042｜tsconfig 继承一致性与可解析性核验

## 1) 范围

- 固定源码基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 审核目标：对仓库 tsconfig 继承关系进行一致性复核，重点核查：
  - 根配置 `tsconfig.json` 与关键运行模块的继承一致性；
  - 关键 tsconfig 的 `extends` 可解析性；
  - 历史归档路径是否会影响运行入口。
- 覆盖文件：
  - `tsconfig.json`
  - `01_core_hexin/services/commerce-api/tsconfig.json`
  - `01_core_hexin/packages/api-contract/tsconfig.json`
  - `01_core_hexin/packages/smart-wing-authz/tsconfig.json`
  - `01_core_hexin/apps/auth-web/tsconfig.json`
  - `01_core_hexin/apps/storefront-web/tsconfig.json`
  - `05_docs_ziliao/VI_shijue/version-upgrades/ZHU-VI-1.2/source/packages/design/tsconfig.json`
  - `05_docs_ziliao/VI_shijue/version-upgrades/ZHU-VI-1.3/source/packages/design/tsconfig.json`

## 2) 核验结论

- [FACT][E-AU-042-001] 核验确认：`tsc --showConfig` 的入口链与现有 tsconfig 分布整体上并不形成“统一继承面”；至少有 5 个关键生产目录 tsconfig 没有继承根配置：`services/commerce-api`、`packages/api-contract`、`packages/smart-wing-authz`、`apps/auth-web`、`apps/storefront-web`。
- [FACT][E-AU-042-002] `services/commerce-api/tsconfig.json` 为生产 API 包的独立配置，含 `strict`、`target ES2022`、`moduleResolution bundler`，但缺少根配置中的 `noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`useUnknownInCatchVariables`、`noImplicitOverride`、`allowImportingTsExtensions` 等策略项；该漂移当前尚未看到直接运行故障证据。
- [FACT][E-AU-042-003] 归档目录 `05_docs_ziliao/VI_shijue/version-upgrades/ZHU-VI-1.{2,3}/source/packages/design/tsconfig.json` 存在 `extends: ../../tsconfig.json`，但上级基础文件在当前仓库中不存在。该项仅在归档文件树中出现，并未在当前 `package.json`/构建入口中被引用。

## 3) 风险与建议

- 风险等级判定：`E-AU-042-001` / `E-AU-042-002` 当前作为结构性一致性观察，不立即证明运行缺陷；建议记录为可控技术债。
- [P3][E-AU-042-001] 建议修复或显式说明：在不改业务实现前提下统一关键目录 tsconfig 的继承边界（至少保持核心服务包、页面包的策略一致性）。
- [P3][E-AU-042-003] 归档 tsconfig 的坏继承建议作为历史归档治理项；若未来被构建脚本误引用，先修复路径或排除该目录。
- 不在本次审计中修改任何代码；仅形成一致性边界证据与复核意见。
