# AU-027｜Meal Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/meal`
- 覆盖：12/12文件、507/507行深入审阅。
- 运行链：Channel Catalog/Price jobs → Registry → MealProvider → CakeuncleClient → 七品牌门店菜单API。

## 结论

- F-0112/P2：一个installation可配置多个品牌/门店scope，但启动和周期health只调用排序后的第一个scope且不映射响应；其余scope不可用或返回畸形菜单时仍可被判healthy并激活。
- F-0113/P2：Price每批对命中的门店重新拉取整份菜单；Channel按external ID每500 key分批，同一大菜单会跨批重复下载和映射。
- F-0114/P3：BrandCatalog和Provider直接引用`@shop/vendorcore`类型，但package.json没有声明该直接依赖，隔离安装和依赖影响图依赖工作区提升行为。
- F-0115/P3：行为测试只覆盖KFC单门店正常路径；其余六品牌、多scope health、500键边界、错误聚合和ID反事实均未覆盖。
- DC-0034/GX：未导出的OrderDraft保存七品牌非幂等下单字段契约但缺订单幂等键和重查能力，禁止直接删除或启用。
- DC-0035/G1：`mapMealError`与`MEAL_BRAND_NAMES`固定仓库零caller但属于公共导出；MealWebhook继续由DC-0026覆盖。

## 保留设计

- manifest/factory只发布Catalog/Price；Order/Webhook明确不进入barrel和runtime port。
- 门店scope锁定已知品牌endpoint，解码后校验长度/控制字符并拒绝重复品牌门店。
- Mapper对每条坏商品生成显式record error，校验价格/划线价并以稳定序列化生成版本。

## 验证状态

- 正式test/typecheck因缺vitest/tsc在源码加载前退出127；未安装依赖、未build。
- 未连接Meal供应商、数据库或线上installation；无P0证据。
- 没有修复、删除、推送、合并或部署。
