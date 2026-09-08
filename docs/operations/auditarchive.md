# 审计归档运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

`auditarchive` 定时任务积压、热存储达到容量阈值、归档对象摘要不一致、归档引用冲突、Legal Hold 分类异常或恢复抽检失败时触发。热存储增长但证据仍完整为 P1；Hash 链断裂、对象丢失、未授权删除、跨 Scope 可见或保留期被绕过为 P0。归档故障不得降低在线审计记录的不可变性。

## Owner 与前置权限

Audit Owner 主责，Reliability、Security、Database 和 Legal 按事件类型协同。诊断只需审计目录、任务和对象元数据只读权限；重试需要 `auditarchive` 任务执行权限；Legal Hold 变更必须由 Legal 与 Security 双人审批。任何操作均不得读取 KMS 密钥值、归档明文或不属于授权 Scope 的 PII。

## 只读诊断（Diagnosis）

按 `{environment}`、`{scopeId}`、`{jobId}` 和 `{archiveRange}` 读取有效保留规则、Legal Hold、唯一任务状态、Checkpoint、热记录边界、首尾链 Hash、数量、对象引用、对象大小、SHA-256、KMS Key 版本和 Deadletter。确认一个范围只有一个有效归档租约，源记录没有发生更新，且对象引用与数据库引用都属于同一 Scope。

正式归档前必须运行 Dry-run。Dry-run 冻结候选边界，输出但不包含正文的 `{fromId}`、`{toId}`、`{fromTime}`、`{toTime}`、记录数、总字节、首个 `previousHash`、末个 `entryHash`、Manifest Hash、保留策略版本和 Legal Hold 结论。Dry-run 不上传对象、不写归档引用、不删除热记录；其证据 Hash 必须由正式执行原样引用，否则重新 Dry-run。

## 止血（Stop loss）

发现摘要、边界、Scope、保留或对象冲突时暂停该 Scope 的归档调度，保留热记录、失败任务、Dry-run Manifest、已上传不可变对象和现有归档引用。停止人工重复建任务；禁止删除、覆盖、重命名对象，禁止修改 `audit.archiveref`，禁止关闭不可变触发器或缩短保留期。

## 恢复（Recovery）

正式执行只接受仍有效的 Dry-run Hash，以冻结边界分片、加密并上传确定性对象；上传后重新读取对象元数据并核对 Hash、大小、Key 版本和 Scope。只有对象核对成功，才可在一个数据库事务中写入归档引用并删除完全位于冻结边界内的热记录。相同内容的重试复用对象；同路径不同 Hash 立即隔离。数据库提交失败时保留对象并幂等重试，不覆盖对象；热记录已删除时以现有归档引用为准，禁止再次删除相邻区间。

## 数据核对（Data repair / Validation / Escalation / Audit）

核对 Dry-run、正式 Manifest、对象和 `audit.archiveref` 的范围、数量、总字节、首尾 Hash、SHA-256、KMS Key 版本完全相同；确认归档范围没有间隙或重叠，下一条热记录的 `previousHash` 指向归档末 Hash，已归档 ID 不在热存储，未到期或 Legal Hold 记录仍在热存储。

每次执行至少从首、中、末三个位置抽取记录进行恢复验证：在隔离环境解密到只读临时存储，重算逐项 Hash 和整批 Manifest Hash，验证 Scope/RLS、时间顺序、查询可见性和内容分类，随后销毁临时明文。每月至少完成一次跨归档批次的连续链恢复抽检。证据记录抽样规则、数量、Hash、验证人和销毁回执，不记录正文。

## 回滚边界

对象上传前可取消；对象上传后只允许保留并继续数据库提交，不能覆盖或删除；热记录删除事务提交后不能通过手工插入回滚，只能依据不可变对象执行经审批的前向恢复。Legal Hold、保留规则和历史归档引用只能新增版本，不原地改写。

## 沟通模板

“审计归档事件 `{incidentId}`，严重级 `{severity}`，Scope `{scopeId}`，冻结边界 `{archiveRange}`，Dry-run Hash `{manifestHash}`，当前影响 `{impact}`，止血措施 `{containment}`，下一核对时间 `{nextCheck}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

唯一任务与租约正常；Dry-run 和正式执行 Hash 一致；边界、数量、对象元数据、数据库引用和 Hash 链全部通过；未到期、非目标 Scope 和 Legal Hold 记录均未触碰；恢复抽检与临时明文销毁完成；积压回到 SLO；审批和不可变证据归档完成。

## 复盘链接（Postmortem）

Hash 不一致、未授权变更、跨 Scope 可见、丢失证据、错误边界、恢复抽检失败或积压越过存储 SLO 必须填写 `{postmortemUrl}`，记录根因、检测缺口、受影响范围、修复任务、验证证据、Owner 与到期日。
