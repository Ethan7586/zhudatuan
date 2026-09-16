# AU-010 定向验证结果

| 验证入口 | 退出 | 结果分类 | 可证明 | 不可证明 |
| --- | ---: | --- | --- | --- |
| `npm test --workspace @shop/authz` | 127 | 环境阻塞：`vitest` command not found | 正式入口和依赖未安装事实 | 4 个包测试通过/失败、生产正确性 |
| `npm run typecheck --workspace @shop/authz` | 127 | 环境阻塞：`tsc` command not found | 正式 typecheck 入口和依赖未安装事实 | 类型检查通过/失败 |
| PermissionCatalog/operations.yml 静态复算 | 0 | 结构一致 | 184 permission、33 category、329/345 受保护 Operation；unknown=0、unused=0 | 每条业务 permission 映射的产品意图 |
| 实际 Policy 源码：二级 permission deny 探针 | 0 | 只读反事实命中 | route `access.role.manage` precheck 通过后，`checkScope` 对已显式 deny 的 `access.scope.manage` 仍返回 evidence | 线上是否存在该权限组合或已被利用 |
| 实际 Policy 源码：异常 scope 三组探针 | 0 | 只读反事实命中 | 错误 platform ID、缺 tenant 的非平台 grant、同 ID 跨 kind 均可命中对应构造场景 | canonical 生产 DB 当前是否产生这些异常值 |
| 实际 Policy 源码：有效期/step-up 边界 | 0 | 正向边界 | `expires == now` 拒绝；step-up 900 秒整允许、更旧/未来拒绝 | AccessPipeline assurance level 的完整运行行为 |
| 实际 catalog mutation 探针 | 0 | 只读反事实命中 | catalog/definition 外壳冻结；scopes 和 SCOPE_KINDS 未冻结；默认 scopes 在 80 条 definition 间共享 | 当前生产是否有 mutation caller |
| WebBusiness resolver 旧 fixture 探针 | 0 | 测试漂移反证 | 旧 actor 对现实现返回 `AUTH_MEMBERSHIP_CONTEXT_MISSING`，query 次数 0 | 完整 Commerce suite 的其它测试结果 |
| pg 8.16.3 OID 20 parser | 0 | 运行时类型反证 | bigint 文本 `7` 解析为 JavaScript string | 线上驱动是否由未发现的外部 bootstrap 改写 parser |
| 3 个高风险文件消费者反向复核 | 0 | 同一主审二遍复核 | 3/10 文件从 AccessPipeline/contractgen/测试入口重追，结论一致 | 独立第二审阅者结论；RV-0009/RV-0008 未完成 |

未运行完整仓库测试、数据库重放、production build 或浏览器页面；这是单模块审计，且全量验证只允许最终收口一次。没有安装依赖或修改锁文件。所有源码探针都读取固定审计基线；借用另一隔离 worktree 已安装的执行器只用于加载本基线源码，没有读取或修改该修复分支的源码与 Git 状态。
