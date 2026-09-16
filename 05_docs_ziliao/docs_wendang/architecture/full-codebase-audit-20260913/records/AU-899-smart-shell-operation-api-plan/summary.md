# AU-899｜旧 Smart 外壳与新 Operation API 融合方案审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`SMART-SHELL-OPERATION-API-INTEGRATION-PLAN.md`，1 个文件、356 行。
- 方法：主样本审阅状态、前端/组织/迁移/发布目标与禁止项；核对当前 ScopeShell 路径、拟议组织 Operations、release domains 和消费者，不重复 Console/身份/发布模块深审。

## 结论

文件明确是 2026-08-24、基于 `Shop/smart-wing` 的“待批准实施”计划，保存了旧新 API 不双写、Host-only 会话、Operation-only、切换/回滚/迁移顺序等重要历史设计约束。

当前 ScopeShell 已位于 `src/shell`，文中多处 `src/app`/`adminBff`/`CockpitApi` 路径不存在；拟议的 Tenant/Enterprise/Mall/Experience binding Operations 未见当前 contract/服务注册。域名仍出现在受控 release 清单，但不能证明计划中的灰度或切换已发生。未发现当前消费者。记录 F-0349（P3），归 DC-0137（G1）；不得删除、创建组织、迁移数据、改域名路由或执行切换。

未运行构建、质量门、服务、数据库、发布、DNS、浏览器或云控制面；未修改业务代码、配置、测试、工作流、迁移或运行资源。
