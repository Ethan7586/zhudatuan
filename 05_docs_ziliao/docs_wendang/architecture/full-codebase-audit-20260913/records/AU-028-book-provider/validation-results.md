# AU-028 验证结果

- `npm test -- --reporter=dot`：127，vitest缺失。
- `npm run typecheck`：127，tsc缺失。
- 履约静态反事实：Book manifest包含Order/Shipment，不含Logistics；submit固定排入tracking，tracking固定调用`require(book, scope, 'Logistics', 'tracking')`，Registry先拒绝capability。
- capability-port矩阵确认：Return和Refund都在manifest，factory只有一个refund port且operation为`book.return.submit`。
- 未安装依赖、未build、未访问Wenxuan/数据库/线上。
