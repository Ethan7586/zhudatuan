# AU-052｜risk 风险规则、案件复核与异步回放深审

- 运行入口：RiskModule 加入 Commerce 模块表；`risk.center.read`、策略管理与案件审核经 transaction/idempotency/audit pipeline 执行；`riskscan` 注册为风险 Worker，既处理策略回放也处理目录阻断。
- 判定链：RiskCheckAdapter 在 API 数据库上下文中构造 scope hierarchy；EvaluateRisk 合并有效策略、24 小时信号、block list 与速度窗口，持久化最严重的结果，deny/review 创建 case，deny 事件及 catalog listing deny 再入队。
- 审核与策略：案件读取以 `FOR UPDATE` 在 transactional operation 内进行，独立审阅者和合法状态迁移在领域模型中限制；candidate 需回放 `passed` 且不能由同一创建者激活。策略/案件/回放/目录任务的写入和 outbox 使用同一请求或 job transaction。
- 边界：风险策略终态后是否允许使用同 id 再创建候选未由契约或测试明确表述，登记为未验证语义，未将其写成缺陷。generic job 进程崩溃的领取恢复风险已由 F-0143 统一记录，不重复编号。
- 共 824 行风险模块文件纳入本单元；未发现 P0–P3 新问题。正式 Vitest 未运行（固定审计 worktree 缺 `vitest` 命令），未安装依赖或改变运行状态。
