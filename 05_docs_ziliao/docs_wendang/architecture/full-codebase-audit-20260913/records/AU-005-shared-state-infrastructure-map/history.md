# AU-005 历史证据

历史只用于解释当前结构的形成，不替代运行入口和现行代码证据。

## 1. Secret/KMS 授权分叉

- `88a625c0f` 引入的 Local Secret/KMS Main 已自行实现无授权业务 handler。
- `fe3269c8` 增加授权 Handler、WorkloadAccessPolicy 及测试，但当前生产 Main 未改为调用它们。
- `89dfa544`/相关构建修订把 `LocalSecretsMain`、`LocalKmsMain` 映射到这些 Main；没有改为授权 Handler 的组合入口。
- `062e481a` 把 Main 切到统一环境解析器，使 full-staging policy path 能被解析和校验；Main仍未读取返回的 `workloadAccessPolicyFile`。

[INFERENCE] 这是“新授权实现与旧运行入口并存”的演进分叉，不是静态扫描误把测试 helper 当生产代码。作者意图仍不可从提交标题推断。

## 2. 通用 Jobs 与正式目标收敛

- `JobsMain`/`FullJobsMain` 长期持有 OutboxRelay 与 RuntimeScheduler。
- 后续正式发布目标收敛为 identity-notification、catalog、payment 三类 dedicated Jobs；release/remote policy 没有 aggregate Jobs target。
- Catalog Jobs 后续加入 scope 隔离，但 reporting export configuration 未携带scope，保留通用claim分支。

[FACT] 当前文件树同时保留“完整聚合控制面”和“只部署专用worker”的两套边界；历史不能证明有人在图外运行aggregate进程。

## 3. PostgreSQL 初始化契约

- PG17 compose pin 与 RDS-style init guard均可追溯到固定基线前提交。
- 初始化fixture名称和检查脚本都明确只覆盖PG16；检查脚本验证fixture token存在，但没有对 compose image major 与 init允许major做交叉断言。

[CONFLICT] 现行文件组合本身互斥。旧非空volume可以继续启动，不构成fresh recovery已验证的证据。

## 4. Local Objects 与 Redis

- Local Objects 的content-addressed reference、loopback publicEndpoint和直接`scan=clean`来自同一早期实现，没有后续scanner或public host接线提交证据。
- RedisCache从引入时就显式关闭自动重连；现有tests验证degrade，不验证同进程恢复。

## 5. 历史未授权推论

本AU没有根据提交标题认定功能下线、没有根据“零引用”删除文件，也没有把旧文档中的backup/authorization承诺写成已运行事实。所有历史结论都与当前build、systemd、target和调用链交叉验证。
