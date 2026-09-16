# AU-448｜跨域 keyset 分页索引

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821038000_add_keyset_indexes.sql`（50 行）。
- 交叉核对：Commerce 各领域 `queryPage/keysetResult` 调用和以 `(time,id)`、scope、状态为条件的运行查询。
- 本批为静态索引与访问关系审阅；未执行 `EXPLAIN`、数据量基准、构建或线上操作。

## 运行结论

迁移为权益、券、目录、库存、财务、发票、合作方、营销、结算地址、体验、扩展、通知、核验、资质、能力、风控、订单、渠道和支持提供稳定排序索引。多数组合以 scope/成员过滤并追加时间或 id，匹配当前 keyset cursor 的排序与下一页谓词。

迁移以 catalog、ordering、support 三个关键索引存在性断言及 schema version 留下可验证的迁移头证据；应用层广泛采用 keysetResult 而非 offset 分页。

## 审计结论

- G0：支撑当前 keyset 分页查询的跨域索引与迁移验收断言，不是删除候选。
- 未有真实执行计划、数据分布或写入成本证据，不能仅凭静态分析裁定单个索引冗余。
- 本批未新增 P0–P3。
