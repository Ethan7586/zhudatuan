# AU-011 定向验证结果

| 验证入口 | 结果 | 可证明 | 不可证明 |
| --- | --- | --- | --- |
| 固定基线文件/blob核对 | 4文件/267行一致 | 本AU文件范围与基线内容 | 仓外副本 |
| 兼容目录与canonical目录实际加载复算 | 86 vs 184；重合8 | 两套code/risk集合真实差异 | 产品迁移意图 |
| Membership/expiry/deny探针 | 状态、边界和deny按控制流拒绝 | 纯函数分支 | 线上数据 |
| step-up边界探针 | 900秒允许；更旧/未来拒绝 | 默认时间边界 | 外部时钟同步 |
| mutable Set探针 | 删除order.refund后无step-up允许 | F-0032在兼容Authz成立 | 生产是否有mutation caller |
| Infinity窗口探针 | 2000年验证在2026年被允许 | F-0061反事实 | 当前caller已利用 |
| wrong-scope critical探针 | 无step-up先challenge，有step-up后scope mismatch | F-0062顺序 | 当前用户流量 |
| 正式workspace test | Missing script: test | 正式入口不存在 | 13用例执行结果 |
| 正式workspace typecheck | Missing script: typecheck | 正式入口不存在 | 源码类型通过/失败 |
| 发布入口反追 | 旧admin制品被禁止；Storefront只载public router | 当前仓库发布关系 | 线上历史进程 |

没有运行全仓测试、完整构建、数据库重放或浏览器；没有安装依赖。借用隔离修复worktree中已存在的tsx只作为执行器，所加载的api-contract两份关键源文件哈希与固定审计worktree一致，未读取或修改修复分支源码/Git状态。
