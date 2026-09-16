# RV-0032｜legacy 数据库对象退役独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0010
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：审阅退役事务、紧随target-head断言和固定迁移契约序列；未执行数据库操作。

## 不可逆责任

退役迁移在维护窗口事务内清除全部legacy `public`业务表、视图、序列、旧API/模拟函数，以及早期库存切换表与敏感stage表。`DROP ... CASCADE`是显式设计，目的在于不保留旧模型的fallback、trigger或权限边界。

## 后继验收

紧随的target-head迁移会在任何public业务表、legacy库存表、敏感stage、旧public API或广泛grant仍存在时fail-closed；同时要求全域reconciliation evidence/hash无差异、RLS启用、安全definer search path和应用角色限制成立。数据库契约脚本把退役和target-head置于固定序列。

因此它既是不可逆退役动作，也是后续安全/数据模型一致性前置，不能因当前运行代码不再引用旧对象而删除文件或把它单独重放。

## 裁决与未知项

维持GX。未读取备份、实际migration ledger、维护窗口记录、目标数据库依赖或恢复演练；不能断言生产切换已安全完成。任何治理只能在最新主线的独立数据库恢复设计中，先确认完整备份、回填/对账证据和可恢复路径。本审计分支未改变数据库或部署状态。
