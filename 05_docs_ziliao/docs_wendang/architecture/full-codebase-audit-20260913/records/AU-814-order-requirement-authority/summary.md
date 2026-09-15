# AU-814｜订单需求权威输入与 Authority 测试

- 审阅范围：`requirementgen/definitions/order.yml`（719 行）、`Authority.test.ts`（61 行）、Authority loader与workspace test入口。
- 结论：订单profile有14项OMS需求，明确Existing/Designed数据对象、existing/planned operations、范围、测试计划和工作包；所有条目目前均为Designed，不能被误读为已交付行为。Authority loader以repository-relative path、realpath containment和SHA-256冻结 workbook，并测试path traversal与仓外symlink拒绝。
- `npm run test --workspace @shop/requirementgen`在运行任何用例前因`vitest: command not found`退出127；此固定审计环境验证为未执行，已有全局依赖缺失记录，未安装依赖。
- 定义是生成器的权威输入、测试是其安全边界规格，均为 **G0**；无新 finding。
