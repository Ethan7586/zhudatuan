# AU-027 验证结果

- `npm test -- --reporter=dot`：127，vitest缺失。
- `npm run typecheck`：127，tsc缺失。
- 多scope静态反事实：Provider把`scopes[0]`传给唯一probe，health只invoke这一scope且不调用Mapper/data。
- 调用量推导：Channel按external ID最多500 key一批；Price对本批每个命中scope下载和映射整份菜单，同scope大于500个映射商品时重复调用。
- 依赖清单对照：两个源码文件直接引用`@shop/vendorcore`类型，package dependencies未声明。
- 未安装依赖、未build、未访问供应商/数据库/线上。
