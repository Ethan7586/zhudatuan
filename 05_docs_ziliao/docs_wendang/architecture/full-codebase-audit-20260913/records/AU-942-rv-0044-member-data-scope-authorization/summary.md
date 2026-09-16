# RV-0044｜成员个人数据 scope 授权函数独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0022
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅授权函数、API 数据库上下文和成员/身份调用点；未访问生产成员资料或数据库权限。

## 迁移责任

迁移重定义 `access.scope_allowed`：只允许当前授权 scope 及其下级，或者活跃 membership 的 member ID、所属组织及其下级；函数注释明确排除祖先和兄弟 scope。目标断言要求授权函数与 access membership 表存在。

## 当前运行关系

API 事务通过 `applyApiDatabaseContext` 设置 app.membership_id 与 app.scope_id；会员、身份和邀请路径使用 `access.scope_allowed` 或依赖 access membership 的授权上下文。成员 profile 读取由 access membership 与 profile 联结，注册和会话也按活跃 membership 处理。

## 裁决与未知项

维持 GX。已静态确认函数是跨模块 RLS/授权边界；未验证真实组织树、RLS 策略、边界 scope、会话上下文污染或恢复。后续变更须从届时最新主线建立独立身份/授权/数据库专项；本审计分支未读取个人数据。
