# AU-007 历史取证

历史只用于解释固定基线的结构与设计迁移，不代替当前代码事实。

## 关键演进

- 2026-09-04 `fe3269c8`：仓库完成首批目录前缀整合；Error checker 的 catalog 路径随之更新为 `01_core_hexin/...`，扫描 roots 仍保留旧顶层 `apps/extensions/packages/services/tools`。
- 2026-09-08 `ee0a6a1f`：capabilities.yml 最近一次内容演进；固定基线仍由 contractgen 加载。
- 2026-09-11 `54fd5825`：Storefront member 自定义标签/字段、两条 manage Operation、Console 调用、handler 与迁移同批进入；permission 从引入时即为 `member.read`。
- 2026-09-12 `8b4a4c79`：统一执行内核、named schemas、writePath 推断和生成 metadata 收口；所有 Operation 当前仍依赖 generator 推断 writePath。
- 2026-09-12 `57c1177d`：明确移除生产 Controller 中的旧 Operation schema 运行时校验，generator 先插入 parser 再用正则替换成 no-op。
- 2026-09-12 `efbfc3ea`：解除旧契约数据库状态作为 runtime readiness 权威；兼容检查仍读取 contract 状态，但健康接受条件不再包含它。

## 审计含义

- `member.read` 绑定不是后来生成漂移，而是与写能力同批进入并被测试固定；是否符合产品授权意图必须独立复核，不能在审计分支自行改成 `member.manage`。
- 当前 Controller no-op 不是遗漏生成，而是明确架构决策；F-0038 评价的是 OpenAPI/SDK/测试仍把通用 named schema 当作真实契约所形成的跨制品不一致。
- 当前 `CONTRACT_CHECKSUM=056713…` 与旧 `RUNTIME_CONTRACT_CHECKSUM=d7e499…` 不同不能单独证明线上错误；旧 runtime authority 已有明确移除历史。
- capabilities.yml 的历史文档与当前代码冲突必须按 [STALE] 记录；生成器仍加载它，因此不能据文档直接删除。
- Error checker 的根目录漂移跨越多个后续契约提交仍存在，属于当前门禁实现事实，不是一次临时路径噪声。
