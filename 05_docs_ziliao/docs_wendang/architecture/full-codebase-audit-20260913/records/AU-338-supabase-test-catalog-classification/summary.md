# AU-338｜Supabase 测试目录初始分类

`20260725007000_classify_test_catalog.sql` 是一次前向数据迁移：仅对 `is_test=true` 的历史商品，以商品名称、摘要和来源详情的英文关键字把早期 `category_code` 投影到 food、digital、appliance、personal、home、supermarket 或 welfare。它不注册 RPC、路由、Worker 或周期任务。

后续迁移新增有状态、有置信度的双语 taxonomy，并将低置信度分类送入治理路径；canonical 目录读模型再以 taxonomy 路径、置信度、状态和库存条件确定可见性。因此这个简化分类器只承担历史测试数据的起始投影，归 G0（不可改写迁移历史），不应被解释为现行商品分类规则或删除候选。

未发现新增 P0–P3。未运行数据迁移，避免修改历史测试商品。
