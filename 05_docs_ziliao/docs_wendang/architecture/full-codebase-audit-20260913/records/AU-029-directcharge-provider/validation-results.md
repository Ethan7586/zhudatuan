# AU-029 验证结果

- `npm test -- --reporter=dot`：127，vitest缺失。
- `npm run typecheck`：127，tsc缺失。
- 履约静态反事实：Directcharge manifest不含Order/Logistics，Fulfillment固定请求这两个capability，Registry在port调用前拒绝。
- capability-port矩阵确认：manifest的业务能力词汇与order/tracking/refund/verification ports没有固定映射。
- 未安装依赖、未build、未访问万联/数据库/线上。
