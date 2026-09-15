# RV-0042｜Membership 从 member 到 access 的所有权迁移独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0020
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅迁移、Access public port、Identity 注册/会话路径及启动检查；未访问生产身份、会话或数据库。

## 迁移责任

迁移将 `member.membership` 物理移入 `access` schema，并以目标断言要求 `access.membership` 存在且旧 schema 中不得保留兼容表。它同时固定 schema ledger 校验和操作登记数量。该变更把 membership 的表所有权与角色、授权范围和会话版本的领域所有权对齐。

这是身份和权限的物理数据边界，而非可通过别名或无引用文件判断为无用的兼容改动。

## 当前运行关系

静态检索未发现生产 TypeScript 的 `member.membership` SQL 引用；`access.membership` 被 Access port 用于创建角色关系和版本提升，被 Identity 的注册、会话、邀请、凭据和微信链路用作授权上下文，也被 Web/Provisioning runtime 的就绪前置检查直接要求。Member 模块保留 profile 等成员资料责任，但不拥有 membership 表。

## 裁决与未知项

维持 GX。已静态确认迁移后的所有权与当前 session/role/access 启动链一致；未验证历史 memberships、联合身份、角色/会话版本、RLS/grant、备份恢复或 schema ledger 的真实部署状态。后续变更须从届时最新主线建立独立身份/权限/数据库专项；本审计分支未读取身份或会话数据。
