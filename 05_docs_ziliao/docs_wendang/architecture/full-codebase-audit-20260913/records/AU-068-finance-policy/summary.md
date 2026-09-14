# AU-068｜finance 政策工作流与读取深审

- preview 严格限制字段，校验 settlement/tax/field-definition 规则与 mall 授权范围，再委托受管 preview 过程；manage 绑定 preview hash、idempotency、version、request hash。读取展示每个 policy 的最新 revision 或当前 policy。
- ConfigFieldPolicy 严格验证字段/税率/日期/选项；既有测试覆盖其主要输入边界及 preview/manage 参数，但没有真实数据库工作流、审批分离、mall delegation 或 revision/read 集成测试。
- 新增 F-0155/P2；未发现 P0/P1，Vitest 未执行（固定审计 worktree 无可执行文件）。
