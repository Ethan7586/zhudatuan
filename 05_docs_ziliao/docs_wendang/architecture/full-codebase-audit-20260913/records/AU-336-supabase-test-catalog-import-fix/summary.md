# AU-336｜Supabase 测试目录导入修正

`20260725005000_fix_test_catalog_import_rpc.sql` 以前向方式重定义 AU-335 的 `api_import_test_catalog`，保留输入批量、ABO 标识、测试供应商、测试商品、零价 SKU 与零库存的相同边界；本次改动只在 JSON 文本提取处增加显式括号，避免表达式解析歧义。权限不在本迁移重复声明，沿用前一迁移的 `service_role` 授权。

该 RPC 后来由 canonical inventory 单一来源切换撤权并删除，且目标契约测试要求其不存在。文件保留为不可改写的历史迁移步骤，归 G0，不构成现行生产导入入口或删除候选。

未发现新增 P0–P3。未运行迁移或导入操作，避免写入测试目录数据。
