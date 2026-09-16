# RV-0056｜Platform Owner 门店管理权限授予独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0034
- 结论：**维持 GX；未发现 P0。**

迁移向 `role-platform-owner-v2` 补 `partner.read/manage`，并对 `partner.manage` 存在性 fail-closed。门店 read/manage 是 Partner 模块正式入口，capability 使用这两项 permission，查询仍按 `scope_allowed` 限制。它补齐平台 Owner 已发布职责，非重复授权；真实 owner 权限全集、deny、审计与恢复未验证。
