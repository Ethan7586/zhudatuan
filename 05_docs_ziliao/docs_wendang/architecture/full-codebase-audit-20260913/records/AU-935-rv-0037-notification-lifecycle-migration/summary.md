# RV-0037｜通知投递与成员可见性迁移独立复核

- 复核日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 对应候选：GX-0015
- 结论：**维持 GX，禁止删除、改写或单独重放；未发现 P0。**
- 方法：重新审阅迁移、事件消费者/投递 Worker、成员可见性路径和作业注册；未访问生产通知、成员资料或第三方通道。

## 迁移责任

迁移从模板、成员关系和 endpoint 回填既有 dispatch 的 scope、成员、渠道、主题和正文，并把 attempt 绑定到 scope 化 dispatch；任何 dispatch 缺失 scope/channel/body 都在提交前 fail-closed。它重建按成员或组织 scope 的 RLS，把派送幂等和模板外键改为 scope 化键，加入公告/偏好授权状态，并重写通用资源 scope 与成员受众的能力契约。

这是通知内容、收件人身份、运营可见性和重复投递边界的历史转换，不能被当前同构投递实现替代或删除。

## 当前运行关系

通知事件消费者为每个适用模板构造 `Dispatch`，经 repository 写入带 scope/member 的 dispatch 与 `${event.id}:${channel}` 幂等键，再由 `NotificationJobProcessor` 驱动投递。模块声明发布 `notification.delivered`，应用事件表将该事件交给投影；通知作业是正式注册的运行单元。成员偏好、endpoint、公告、模板和 dispatch 的当前读写仍经过此次迁移建立的 scope/member RLS。

## 裁决与未知项

维持 GX。已静态确认历史缺口 fail-closed、当前消费者/Worker/事件链和成员授权仍依赖目标结构；未验证实际回填、成员与运营可见性、第三方通道幂等、失败重试、公告受众、备份恢复或 schema ledger。后续变更须从届时最新主线建立独立通知/数据库专项；本审计分支未发送通知或访问生产数据。
