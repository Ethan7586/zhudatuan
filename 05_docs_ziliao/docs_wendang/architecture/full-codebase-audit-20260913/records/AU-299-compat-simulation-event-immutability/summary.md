# AU-299｜Compatibility 支付模拟事件不可变性

该 migration 为 `payment_simulations` 和 `test_point_ledgers` 添加 UPDATE/DELETE 拒绝触发器，复用早期 migration 的 `reject_immutable_change`。测试模拟 RPC 只向这两类事件表插入记录；可变余额和 voucher 是由事件与审计记录支撑的投影，不在本迁移的不可变范围内。

这是防止测试支付/积分事实被事后改写的 schema 约束，具有迁移顺序责任，分类 G0，非删除候选。未发现 P0–P3 新问题；实际数据库触发器执行未验证。
