# 成员导入运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

成员预检/执行停滞、手机号/员工号重复、Organization/Role 映射错误、邀请失败或跨 Tenant 内容时触发。已有账户与 Membership 不变；越权成员、错误角色或 PII 泄露为 P0。

## Owner 与前置权限

Member Owner 主责，Organization、Access、Identity 与 Security 协同。先遵循 `import.md`；发起人只能导入其管理 Scope，并具备目标角色授权能力，不能借导入提升自身权限。

## 只读诊断（Diagnosis）

除统一证据外，核对员工号/外部主体指纹、Organization 路径、Membership 状态、角色模板版本、邀请/Enrollment、AccessVersion 和重复判定。错误报告只显示脱敏定位信息，不回显手机号、邮箱或身份凭据。

## 止血（Stop loss）

暂停该 Scope 导入与未发送邀请；撤销错误新增 Membership 的活动 Session，并保留审计。禁止直接编辑 Role/Grant/Scope 表，禁止把冲突主体自动合并。

## 恢复（Recovery）

通用重试从 Checkpoint 继续；稳定外部主体键回读已有成员，合法重复为 skipped，不重复建 Identity/Membership/Invitation。映射错误修正文件并新建任务；权限修复走 Access Command 和必要审批。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 核对计数、主体唯一、Organization/Scope、最小角色、AccessVersion、邀请一次性、会话隔离和审计。Data repair 走成员/权限命令；Escalation 对跨 Tenant、提权或 PII 泄露进入安全事件；Audit 只保存主体 Hash 与结果。

## 回滚边界

未接受邀请可撤销；已接受 Membership 只能按成员生命周期停用，历史访问决定不可删除。通用 Import 边界见 `import.md`。

## 沟通模板

“成员导入 `{importId}`，Organization `{scope}`，新增/跳过/失败 `{created}/{skipped}/{failed}`，权限影响 `{impact}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

统一 Import 条件通过；无跨 Scope、无自提权、主体与 Membership 唯一、邀请/AccessVersion/Session 状态一致、PII 未进入证据。

## 复盘链接（Postmortem）

提权、跨 Tenant、主体误合并、PII 泄露或批量邀请异常必须填写 `{postmortemUrl}`。
