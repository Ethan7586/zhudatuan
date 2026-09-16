# AU-026 验证结果

- `npm test -- --reporter=dot`：127，vitest缺失。
- `npm run typecheck`：127，tsc缺失。
- 静态反事实确认：total尚未完成时1–199条非空短页不会触发`assertPage`，下一cursor直接进入下一页。
- 调用量推导：每个非空Price/Stock批次都执行categories + 全部叶分类商品分页；Channel最多500 keys一批。
- 价格链确认：Flower接受`0 < market_price < price`并发布compareMinor；CatalogProductImport明确拒绝该不变量。
- 未安装依赖、未build、未访问供应商/数据库/线上。
