# AU-334｜Supabase 测试目录标识

`20260724234000_test_catalog_flag.sql` 为历史商品表增加 `is_test` 和索引，建立早期目录读模型、拒绝测试商品写入订单项的触发器，以及清理测试目录的服务端 RPC。它将测试目录从可下单商品中隔离，同时保留测试/负载场景的数据识别能力。

后续迁移多次重定义 `api_catalog`，并在 canonical inventory 单一来源切换中撤权并删除 `api_import_test_catalog`、`api_test_catalog_stats` 和 `purge_test_catalog`；该切换仍保留 `is_test` 作为旧数据迁移、对账和目录投影的过滤事实。故本文件不是现行 API 定义，也不是独立删除候选，而是 G0（历史迁移重放与测试数据隔离责任）。

未发现新增 P0–P3。未运行迁移、清理 RPC 或数据库测试，避免任何数据写入或删除。
