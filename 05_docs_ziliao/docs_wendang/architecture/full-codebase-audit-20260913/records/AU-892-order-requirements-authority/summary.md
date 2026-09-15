# AU-892｜订单需求权威工作簿审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`订单需求20260430.xlsx`，1 个 OpenXML 工作簿、17 个归档条目、2 张工作表。
- 方法：只读核验 SHA、归档结构、工作表名称/行数、authority 配置、仓内路径/哈希约束、专用 WorkbookReader、OrderRequirementProfile 及生成的 `requirements/order.yml`；不输出或复制工作簿业务单元格。

## 结论

工作簿实际 SHA-256 为 `2d26811cd4fe3fca65f126432a71f176628d12ff262cd0844498abc3fec9e79e`，与 `orderRequirements` authority 和生成的 `requirements/order.yml` 一致。它含 `20250416需求汇总`（16 行）及 `20260430需求汇总`（274 行）；专用 loader 在仓内 realpath、路径范围与 SHA 校验后，以 WorkbookReader 校验两个行数，并生成固定 OMS-001–014 追踪链。它是当前订单需求 authority，归 G0，禁止删除或用历史文档替代。

定向正式测试 `npm run test --workspace @shop/requirementgen -- OrderRequirementProfile.test.ts` 未启动：环境缺少 `vitest` 可执行文件（退出码 127）。未安装依赖、未重跑或修复；字节一致性生成测试结论为 [UNVERIFIED]，不影响已获得的静态哈希、结构和调用链事实。

未修改工作簿、业务代码、配置、测试、工作流、迁移或运行资源；未执行生成、构建、发布、数据库或外部控制面操作。
