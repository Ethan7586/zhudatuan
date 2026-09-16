# AU-339｜Supabase 测试目录分类统计

`20260725008000_test_catalog_category_stats.sql` 以前向重定义扩展 AU-337 的测试目录统计，新增 `testCategoryBreakdown`，按 `category_code` 聚合测试商品。函数签名未变，因此前一迁移的 service-role 权限持续适用；它不写数据，也没有仓内业务路由调用。

canonical inventory 单一来源切换最终撤权并删除该统计函数，目标契约测试验证此终态。该迁移保留为严格历史序列中的诊断契约，不是现行生产数据面，也不是删除候选，归 G0。

未发现新增 P0–P3。未执行迁移或统计查询。
