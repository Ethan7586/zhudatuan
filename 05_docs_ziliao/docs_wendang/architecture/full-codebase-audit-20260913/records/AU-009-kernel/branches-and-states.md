# AU-009 分支与状态记录

## 1. Git 状态

| 时点 | 分支 | HEAD | 固定基线 | `origin/zdt-next` 只读观察 | 工作区 |
| --- | --- | --- | --- | --- | --- |
| 开工 | `codex/full-codebase-audit-20260913` | `587ee0d4c4fd9f8dfd96f95ac342142b28b02260` | `5a1ce71eebbefaa826368a9e1dc17730f9363bc4` | `6648ddd15f3ea8dfda6eba1238c4c93d77a406c3` | clean |
| 提交闸门前 | 同上 | CP-08 + AU-009 报告差异 | 同上 | `0c641866eb863c7507bda7c94ea6746e43d7904b` | 仅审计目录；远程分支36条 |

[FACT][E-AU-009-001] 固定基线是审计分支祖先；主线从开工观察的 `6648ddd1` 前进，主动 fetch 时先观察到 `68068c77`，随后同仓 push 又将本地远端跟踪指针更新到提交闸门前的 `0c641866`。本单元没有 merge/rebase/cherry-pick 主线，也没有 push、deploy 或线上写入。

## 2. CircuitBreaker 当前状态机

| 当前状态 | 输入/条件 | 当前实现下一状态 | 风险 |
| --- | --- | --- | --- |
| closed | operation 成功 | closed，failures=0 | 正常 |
| closed | 达 threshold 的失败 | open，记录 openedAt | 正常串行路径 |
| closed | 并发请求 A 失败后，旧请求 B 成功 | A: open；B: closed | [BROKEN] B 无代际信息，会撤销 A 的 open |
| open | 未到 recovery | 抛 `CIRCUIT_OPEN` | 正常 |
| open | 到 recovery | halfopen；首个调用占 probe | 正常 |
| halfopen | probe 成功 | closed | 正常 |
| halfopen | probe 失败且 classifier 返回 true | open | 正常 |
| halfopen | classifier 抛错 | 保持 halfopen + probing=true | [BROKEN] 后续调用永久 `CIRCUIT_OPEN` |

## 3. Retry 模式状态

| mode | Kernel 自身强制条件 | Commerce HttpClient 行为 | 已证明的调用约束 |
| --- | --- | --- | --- |
| `read` | 仅校验字符串和次数/延迟 | transport error 可重试 | 调用者将其用于 GET/token 等读取 |
| `businesskeywrite` | 与 read 相同；不接收或校验 business key | transport error 同样可重试 | 部分 adapter 自己发 key；WeChat 丢弃已有 dispatch key |
| `none` | 不进入 Kernel retry | 单次 send | Commerce Executor 自己扩展的模式，不是 RetryMode |

## 4. 模块目录状态

| 对象 | 当前事实 | 运行状态 |
| --- | --- | --- |
| `defineModuleManifest` | 返回调用者原对象；35 个 Commerce manifest 使用 | 活跃静态契约 |
| `ModuleCatalog` | 构造索引、按 capability 拓扑排序 | 只有自身测试，没有生产构造者 |
| 35 个 manifests | 51 unique provides、92 requires、37 missing provider | 若整体交给当前 catalog 会在相应 selection 报 missing；当前 startup 不走此路径 |
| 返回对象 | manifest/arrays/Map 只读类型但运行时可变 | 声明 immutable 与实际不一致 |
