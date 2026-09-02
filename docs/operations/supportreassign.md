# Support 客服批量重分配

- Trigger：客服被禁用、任务连续失败、被禁用客服仍持有活动工单或未分配比例异常。
- Impact：存量工单可能暂时没有可处理客服，但消息、历史和原分配证据保持可读。
- Owner：Support queue supervisor 负责业务分配，Support on-call 负责 Job 恢复。
- Stop loss：暂停继续禁用客服并保护任务租约；锁顺序固定为 Ticket → Assignment，禁止反向加锁或直接改表。
- Diagnosis：检查客服状态、scope、技能、容量、规则版本、候选集、游标和工单 Version Conflict。
- Recovery：修正规则或客服配置后用同一 Job ID 重试死信；每批最多 50 个工单，无候选时安全回到未分配队列。
- Data repair：通过正式转派命令补充遗漏工单并追加原因，禁止覆盖既有 Assignment 与 History。
- Validation：确认被禁用客服的活动分配清零、游标完整推进、每张工单只有一个活动分配且历史与事件齐全。
- Escalation：高优先级工单无人处理、跨 scope 分配或十五分钟内无法恢复时升级客服负责人和 Reliability。
- Audit：保存客服 ID、批次游标、规则版本、释放与新分配 ID、原因、操作者和验证结果。
- Postmortem：记录容量缺口、规则偏差和 owner/action/date 改进项。
