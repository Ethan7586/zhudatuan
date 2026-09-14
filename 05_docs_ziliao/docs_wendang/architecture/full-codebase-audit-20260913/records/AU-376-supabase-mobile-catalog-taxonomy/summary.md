# AU-376｜Supabase 移动目录分类

`20260814194000_fill_mobile_catalog_categories.sql` 只为 `supplier-test-abo` 的测试商品建立 ABO 目录分类器、写入触发器与历史回填；它不会批量改写普通供应商商品。分类器将商品文本和结构化 product type 映射到固定三级 taxonomy；未能可靠归类的测试商品进入 `welfare_review_unclassified`，并同步登记 `catalog_review_queue`，而不是假定为可公开售卖分类。

同一迁移定义公开目录窗口 RPC。该 RPC 仅从 active mall、active product、active SKU、合法三级 taxonomy 且分类置信度不低于 0.8 的记录读取，并以每个一级分类的最新 SKU 配额组成移动端首页窗口；只授予 service role。`commerce-api` 的公开只读路由按无分类筛选时调用此窗口、带分类筛选时调用当前 `api_catalog`；路由还限制 mall slug、分页范围与生产环境公开商城配置，并明确返回不可购买状态。

该迁移的分类、审查队列和公开窗口均仍承担可运行目录职责，归 G0。未发现新增 P0–P3 或删除候选；未执行目录写入、测试或线上页面检查。
