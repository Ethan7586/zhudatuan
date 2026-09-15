# RV-0046｜跨域 member audience 契约对齐独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0024
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅迁移、能力表受众解析路径与生产模块操作注册；未调用任何业务 API。

## 迁移责任

迁移把 cart、checkout、order、benefit、voucher、invoice、support、payment、catalog、pricing、inventory 的 17 个操作标为 `member` audience，并以精确数量和 runtime contract checksum fail-closed。它改变的是跨模块的身份受众事实，而不是前端显示标签。

## 当前运行关系

`access.resource_scope` 的后续版本读取 `capability.operation.audience='member'`，从 membership 解析个人 profile scope；迁移列出的操作均为已注册生产模块入口。该契约因此决定成员调用进入个人 scope 还是运营组织 scope，并被后续授权函数/RLS 使用。

## 裁决与未知项

维持 GX。已静态确认 17 条受众记录和 scope 解析依赖；未逐一验证真实身份、权限、前端调用、错误码、运营边界或历史升级恢复。后续变更须从届时最新主线建立独立权限/契约专项；本审计分支未调用生产 API。
