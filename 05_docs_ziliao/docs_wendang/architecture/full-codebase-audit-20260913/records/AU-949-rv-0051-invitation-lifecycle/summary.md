# RV-0051｜Invitation 生命周期与注册政策历史绑定独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0029
- 结论：**维持 GX；未发现 P0。**

迁移按 invite 生效时间回填并强制 registration policy/terms hash，建立外键、版本和 create/revoke 权限契约；缺失绑定即 fail-closed。当前身份邀请创建、注册和治理角色校验仍使用这些组织、条款与政策事实。它承担历史可追溯和授权边界，不可删除或单独重放；生产历史政策、invite scope 与恢复未验证。
