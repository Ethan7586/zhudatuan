# RV-0028｜环境特定平台 Owner 调和迁移独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0006
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：深读该环境迁移，再核验registration执行计划、契约历史和当前Owner scope约束；未读取生产数据库或身份数据。

## 迁移的真实责任

迁移以本地用户名`ethan`寻找唯一活跃platform owner，补写platform/tenant scope；为暂停命名为`*-test-*`的membership短暂关闭Owner保护trigger，并暂停成员、禁用用户，最终写入审计日志。它在结束前强制恰有一个活跃Owner，否则事务失败。

这不是普通的旧schema创建文件：重放、删除或改写都可能改变最高权限主体、测试身份状态和审计事实。

## 执行与保留边界

`RegistrationMigrationPlan`明确把该文件标为environment-specific reconciliation：registration路径不执行其SQL，但将源文件hash、空执行hash和省略原因写入专用ledger。数据库契约历史仍登记源hash。当前`platform_owner_scope_contract.sql`又要求恰好一个活跃Owner、其platform scope存在，并拒绝非Owner的platform scope。

因此“registration未执行”并不等于文件无责任：它保留环境历史、执行ledger和迁移/恢复解释边界；其他Supabase或仓外执行通道未在本轮访问。

## 裁决与未知项

维持GX，禁止删除、单独重放或作为清理对象。未读取生产migration ledger、真实Owner身份和scope、被暂停测试账号，亦未执行恢复演练；这些只能在获得授权后于独立身份/数据库专项中核验。审计分支不改变任何SQL、身份或运行状态。
