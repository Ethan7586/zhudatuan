# RV-0049｜Membership scopegrant 历史规范化独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0027
- 结论：**维持 GX；未发现 P0。**

迁移按 scope object 校正 self、owner 和组织层级 grant，为活跃 membership 补 self、为 storefront 补 owner allow，并按 membership/kind/scope/effect 去重；任一 kind 不匹配或重复即 fail-closed。当前 Access 操作、会话/授权解析和启动检查均使用 scopegrant/resolve_membership。它承载个人与组织授权事实、版本和恢复，不可删除或单独重放；生产 grant、RLS 和备份恢复未验证。
