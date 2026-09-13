# 全代码库系统审计｜08 测试可信度与缺口

## 1. 当前状态

AU-005识别并人工深审了共享状态设施的定向测试。正式workspace测试在代码加载前因审计worktree未安装`tsx`而阻塞；直接Node strip-types也因extensionless TypeScript import解析失败。未安装依赖，未把环境阻塞写成实现失败或通过。

## 2. 测试可信度

| 测试族 | 能证明 | 不能证明 |
| --- | --- | --- |
| Secret/KMS Handler + policy | 401/403、token比较、exact ref/keyRef逻辑有反事实 | production Main调用了这些Handler；实际bundle鉴权 |
| LocalKms | AES-GCM roundtrip、keyRef/context篡改拒绝 | master key轮换/恢复；HTTP入口授权 |
| LocalObjects | 分片顺序、hash、签名读等局部行为 | public URL可达、真实scanner、digest metadata collision、重启恢复 |
| JobRunner | mock query下的claim/process/retry/deadletter/timeout | 正式worker存在、PG函数真实SQL、业务processor幂等 |
| RuntimeEventPublisher/Event | generated事件版本和inbox/job事务结构 | OutboxRelay被部署、producer在线、live backlog |
| Pool/PgUnitOfWork/Context | 配置、锁序、重试与释放控制流 | 生产role/RLS、真实负载死锁、数据库版本恢复 |
| PG16 init fixture | RDS-like PG16地址/target/sentinel及零变更分支 | production Compose PG17、空卷完整前置、恢复成功 |

## 3. 假阳性风险

[FACT][E-AU-005-006] 最重要的假阳性是授权测试测了未挂载的Handler：测试即使全部通过，production Secret/KMS仍可无Bearer处理。类似地，publisher/job runner测试证明实现语义，不证明进程在正式target图中存在。

因此后续每项验证都必须同时包含：被测实现、真实构建entry、正式release target/systemd和至少一条反事实请求或崩溃状态。

## 4. 当前缺口

1. Secret/KMS production Main的health/401/403/success完整入口测试。
2. 正式target必须恰好拥有一个outbox relay、scheduler和cleanup owner的结构+进程测试。
3. PG17当前Compose空卷恢复测试，且检查器交叉验证image major与init允许major。
4. generic/scoped/identity三种claim对expired running的一致性测试。
5. 远端浏览器对象下载E2E、scanner provenance和same-digest metadata反事实。
6. Redis startup失败与运行中断线后的恢复状态机测试。
7. current PostgreSQL/Object/KMS backup restore演练证据；若存在仓库外流程，需只读接入证据而不是复制描述。

详细执行结果和不证明项见 `records/AU-005-shared-state-infrastructure-map/tests.csv`。
