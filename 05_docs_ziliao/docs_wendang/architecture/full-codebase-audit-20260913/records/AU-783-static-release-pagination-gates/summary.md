# AU-783｜静态发布与分页门禁

- 审阅范围：`check-line-budget.mjs`、`check-platform-delivery.mjs`、`check/lock.mjs`、`check/pagination.mjs`。
- 审阅方式：深读扫描根、需求矩阵契约、lockfile/workspace/Linux optional dependency 解析，以及 Operations SQL 分页文本规则；四个正式只读入口均已定向执行。

## 审计结论

- **G0：全部保留。** 这些脚本分别意图限制生产文件复杂度、检查 MVP 交付证据、锁定 npm workspace 一致性和阻止 offset/无界分页。
- **F-0301 / P2：** line-budget 仍扫描已不存在的顶层 `apps/services/packages/extensions`，固定基线启动即 `ENOENT`，从未进入任何实际源码统计。
- **F-0302 / P2：** platform-delivery 只接受四种大写完成状态，但当前21条 MVP 需求均使用 `Designed`，固定基线在 MVP03 首条即失败；现有 evidence/path 检查无法执行。
- **F-0303 / P2：** pagination 对 `pageResult` 的豁免硬编码为旧路径 `modules/pricing/PricingOperations.ts`；真实实现位于 `pricing/03_application_yingyong/`，转发文件不包含 SQL，因此真实有 `limit 100` 与输入上限的查询仍报错，另有 session/WEB pricing 同类命中。该输出不能区分不安全分页和固定上限列表。
- `check/lock.mjs`在固定基线通过。
