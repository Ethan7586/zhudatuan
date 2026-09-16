# RV-0053｜Identity session 管理与撤销事件独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0031
- 结论：**维持 GX；未发现 P0。**

迁移登记 session read/revoke API、member audience capability 和 `identity.session.revoked` 事件，并以注册数量/checksum fail-closed。当前会话操作和模块 manifest 均注册这两个入口；手机号变更会撤销关联未撤销会话，后续会话更新要求 `revoked_at is null`。它是身份失效、事件契约与安全恢复边界，不可删除或单独重放；撤销/outbox 原子性、消费者、跨 realm 和恢复未验证。
