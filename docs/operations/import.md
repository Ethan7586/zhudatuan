# 统一导入运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

六类导入（member、product、inventory、vouchercredential、finance、order）的上传、预检、确认、分片执行、取消、重试、错误文件或 Deadletter 异常时触发。单任务延迟为 P1/P2；跨 Scope、恶意文件逃逸、重复业务效果、资金/库存/卡密不变量破坏为 P0。

## Owner 与前置权限

Runtime Owner 负责通用机制，具体数据由对应领域 Owner 负责。操作人必须具备目标 Scope 的 Import 权限；确认、重试和取消使用当前 ExpectedVersion、幂等键和授权快照。文件只经私有 Object Reference 传递，命令、日志和证据不得包含 Secret、卡密、PII 或原始行正文。

## 只读诊断（Diagnosis）

先读取 `runtime.imports.read` 和 `runtime.jobs.read`，核对 Kind、Scope、对象扫描、MIME/Magic、大小/解压比、SHA-256、Schema/Mapping 版本、预检 Hash、行数、分片、Checkpoint、Lease/Fencing、成功/拒绝/重复计数、错误文件 Hash 与 Deadletter。不得下载未扫描对象或用数据库直查绕过 Scope。

## 止血（Stop loss）

用 `runtime.jobs.cancel` 请求协作式取消，只停止受影响任务/Kind/Scope；隔离对象并保留已提交分片。格式或业务不变量未知时禁止确认；队列压力下限制新低优先级 Import，不抢占交易、支付、库存、身份与风险队列。禁止删暂存行、改游标、重置 Attempts 或伪造成功。

## 恢复（Recovery）

上传后由领域 Create Operation 建任务，Runtime 完成扫描和流式预检；用户确认冻结预检 Hash 后通过 `runtime.imports.confirm` 执行。Worker 以稳定行键、分片、Savepoint、Checkpoint 和 Fencing 处理；瞬时错误用 `runtime.imports.retry` 只重试可恢复项。永久错误修正源文件后建新版本；同文件重传和进程重启不产生重复效果。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明 `total = accepted + rejected + duplicate`、分片无遗漏/重叠、Checkpoint 单调、错误文件逐项可定位且不泄露、Scope 越界为 0、业务效果与收据一一对应。Data repair 只能走领域 Operation/补偿，不直改权威表。Escalation 由领域 Owner 与 Security/Finance 接管 P0；Audit 保存对象引用、Hash、Schema/Mapping、授权快照、Actor、计数、Checkpoint、Trace 和结果。

## 回滚边界

预检和未开始任务可取消；已提交分片不回退，失败项可幂等重试。错误业务事实按领域规则补偿/冲正，不能靠删除 Import、错误文件或 Job 回滚。原对象、预检 Hash 和执行证据按保留策略不可变保存。

## 沟通模板

“导入 `{importId}`，Kind `{kind}`，Scope `{scope}`，阶段 `{phase}`，进度 `{completed}/{total}`，失败 `{failed}`，影响 `{impact}`，处置 `{containment}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

任务达到 succeeded/failed/cancelled/deadlettered 明确终态；计数、Hash、Checkpoint、错误文件和领域不变量通过；可恢复项处理完成；用户可回读逐项结果；告警恢复且证据归档。

## 复盘链接（Postmortem）

P0/P1、重复效果、跨 Scope、恶意文件、百万行容量失效或同类错误重复发生必须填写 `{postmortemUrl}`。
