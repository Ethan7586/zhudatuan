# RV-0008｜Storefront Member 写权限独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。从 operation contract/migration → route authorization → member handler → Console capability fixture 重追；未读取线上角色、entitlement 或用户数据。

1. `operations.yml:678-717` 将 `member.storefront.config.manage` 与 `member.storefront.custom.manage` 均声明为 PUT、operator audience、`permission: member.read`。
2. 初始 migration `20260911010000...:43-47` 将同一 operation-permission mapping 持久化；较新的 `20260912230000_separate_permission_write_targets.sql` 未包含这两个 operation，因此不构成已修复证据。
3. `OperationController.ts:299-323` 将声明 permission 原样交给 `AccessPipeline`；`AccessPipeline.ts:52-108` 对该 permission 做 membership/scope/capability 判定，没有对“manage”追加写权限。
4. `MemberCustomProfileOperations.ts:20-136` 的两个 manage action 会 upsert/delete 全商城 tag/field 配置，或 delete/reinsert 某会员自定义 tag/field values。`StorefrontMemberRoute.test.tsx:305-316` 明确以仅 `member.read` + 两条 manage capability 作为正常 UI 上下文。

**F-0036 确认 P1，高置信度。** 只授予 `member.read` 的主体在拥有对应 operation entitlement 时可执行持久写；read 名称与真实写语义之间没有额外授权边界。未确认生产角色是否含此 entitlement、是否已有滥用，因此不是 P0。

后续必须从最新主线建立单目的权限修复批次，先由产品定稿所需写权限，再同步 operation 定义、受管数据库绑定、角色/entitlement、Console 可见性和 read-only/write 正反测试；不得把该修复与其它权限收缩或数据操作混批。
