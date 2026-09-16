# RV-0036｜客服生命周期迁移独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0014
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅迁移、Support 命令/仓储、Worker 注册及执行入口；未访问生产数据、对象存储或部署环境。

## 迁移责任

迁移从旧 `support.case` 建立 `conversation`，改名为 `ticket` 并回填一对一关系；消息、历史、分配、附件证据和升级记录均以 ticket 回填 scope 与会话关系，随后删除旧 case 字段/外键。它建立外键、唯一性、按 scope 的 RLS、消息和历史追加式触发器，并重写全局资源 scope 解析以替换对旧 case 的引用；目标断言发现遗留引用即 fail-closed。

这不是名称替换：它把客户会话事实、工单状态、证据访问和通用授权解析迁到同一持久化边界。

## 当前运行关系

Support 命令在 scope/版本条件下读写 `support.ticket`，并把主题更新至关联 `conversation`；消息命令按 ticket 的 scope/conversation 写入证据并投递稳定 ID 的 `supportscan` 作业。仓储为历史与作业显式保存 scope。`SupportJobProcessor` 对附件元数据校验后更新状态，并为 SLA 处理工单；应用 Job 目录正式注册 `supportsla` 与 `supportscan`，包含重试、租约和死信配置。

## 裁决与未知项

维持 GX。已静态确认迁移在目标结构、授权解析和 Worker 链路中仍有真实职责；未验证每条旧 case 的映射、附件对象可用性、实际 RLS、SLA 重排、任务重放、备份恢复或 schema ledger。任何变更须从届时最新主线建立独立客服/数据库专项；本审计分支未执行数据库、对象存储或部署操作。
