# 会话失陷运行手册

## 触发症状、用户影响与严重级（Trigger / Impact / Severity）

Token/Cookie 泄露、异常设备/地域、AccessVersion 失效后会话仍可用、跨 Mall/Scope mismatch、签名 Key 暴露或重放时触发。单会话风险为 P1；跨 Scope 访问、签名 Key 或批量会话失控为 P0。

## Owner 与前置权限

Identity/Security Owner 主责，Access、Mall 与 Support 协同。诊断和撤销使用最小 Scope、Step-up、短时 Breakglass 与审计；不得把 Session Token、Cookie、OTP、Proof、手机号或 PII 复制到事件记录。

## 只读诊断（Diagnosis）

确定最小 Principal、Membership、Target、Scope、Device、Session 与 Signing KeyVersion，读取 Session/Refresh Family、CredentialVersion、AccessVersion、认证/Step-up、授权拒绝、设备和审计时间线。外部身份只读取 Provider Subject Hash 与本地绑定，不导出外部 Token。

## 止血（Stop loss）

先撤销本地受影响 Session/Refresh Family，在受控事务递增 CredentialVersion/AccessVersion 并清除 Target Cookie；广泛 Key 暴露时发布新签名 KeyVersion、Canary 验证后撤销旧版。外部 Logout 是 best effort，不得阻塞本地撤销。跨 Scope 立即冻结受影响 Operation。

## 恢复（Recovery）

要求用户通过安全认证/账户恢复重新登录并重建最小 Membership Session；高风险操作重新 Step-up。工作负载分批加载新 KeyVersion，验证旧会话全部拒绝。企业微信/微信无法全局登出时明确记录“本地会话已撤销”，不伪造 Provider 成功。

## 数据核对（Data repair / Validation / Escalation / Audit）

Validation 证明旧 Session/Refresh/Proof/KeyVersion 被拒绝，Console/Storefront/Miniapp/Store/Supplier Target 与 Mall/Scope 隔离，导航缓存失效，新 Session 权限最小。Data repair 仅撤销/新建事实；Escalation 跨 Scope/Key P0；Audit 保存 Hash、版本和决定，不保存令牌。

## 回滚边界

会话、Proof 和旧 Key 一旦撤销不得恢复，只创建新版本。错误撤销通过重新认证建立新 Session，不能改历史审计。

## 沟通模板

“会话事件 `{incidentId}`，严重级 `{severity}`，影响主体/Target `{subject}/{target}`，撤销范围 `{scope}`，用户影响 `{impact}`，下一动作 `{nextAction}`，Owner `{owner}`，证据 `{evidenceRef}`。”

## 关闭条件

旧会话/Proof/Key 全部失效；新会话与权限/导航/Scope 验证通过；必要用户通知和凭据轮换完成；观察窗无重放；证据归档。

## 复盘链接（Postmortem）

跨 Scope、签名 Key、批量会话、撤销失效或检测超 SLA 必须填写 `{postmortemUrl}`。
