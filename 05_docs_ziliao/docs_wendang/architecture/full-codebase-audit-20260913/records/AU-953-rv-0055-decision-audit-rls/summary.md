# RV-0055｜Decision audit actor/scope RLS 修复独立复核

- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0033
- 结论：**维持 GX；未发现 P0。**

迁移重建 decisionaudit RLS：null scope 仅允许相同 actor，具 scope 记录走 `access.scope_allowed`，并断言 policy 存在。Web risk adapter 按 actor/operation/scope/time 从该表计算速度窗口；Console、Purchase、Web runtime 亦把该表/权限作为前置。它是风险输入的隔离边界，不可删除或单独重放；真实 RLS、actor-less 请求、专用角色与恢复未验证。
