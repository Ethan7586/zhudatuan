# AU-428｜目录与定价初始模型

## 范围与方法

- 主审文件：`02_platform_pingtai/database/supabase/migrations/20260821017000_create_catalog_pricing.sql`。
- 交叉核对：领域数据回填、后续索引和范围授权解析、Commerce operation 契约及 Storefront 的 canonical listing 读取链。
- 本批为静态迁移语义与调用关系审阅；未执行数据库重放、构建、测试或线上操作。

## 运行结论

该迁移建立 `catalog` 与 `pricing` 两个领域的初始关系模型：分类、商品、SKU、商品池与上架、供应商来源和审核、可售区域、导入任务，以及价目表、时效价格、定价规则和下单前报价快照。金额以 minor unit 保存，报价以明细与 evidence hash 固化。

后续回填迁移将遗留目录、SKU、商品池、区域和价格数据迁入这些表；索引迁移为商品、上架、来源与价格查询补充访问路径；范围解析迁移以这些表的 `scope_id` 或 `mall_id` 判定授权域。Commerce contract 定义商品和上架操作，Storefront 通过 canonical client 读取 `catalog.listings`，故初始表不是孤立历史结构。

## 审计结论

- G0：目录、可售范围、上架和可核验报价的基础数据契约；不是删除候选。
- 迁移统一启用 RLS，但本批未重放数据库，实际策略、历史数据完整性与并发写入行为均为未验证项。
- 本批未新增 P0–P3。
