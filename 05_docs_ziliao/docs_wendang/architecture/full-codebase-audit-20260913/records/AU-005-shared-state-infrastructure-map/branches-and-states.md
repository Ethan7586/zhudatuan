# AU-005 条件分支与状态机

## 1. PostgreSQL 启动与恢复

| 条件 | 分支 | 结果 | 证据状态 |
| --- | --- | --- | --- |
| 已存在非空 data volume | official image不再运行initdb脚本 | 容器可按现有数据启动；仍受health影响 | [FACT] Docker entrypoint通用语义；本AU未启动容器 |
| 空volume + PG17 | 执行10-registration-roles.sh | 版本guard抛`ZHUDATUAN_RDS_INIT_POSTGRES_VERSION_INVALID` | [CONFLICT] F-0023 |
| PG16但缺expected server addr | inet转换/地址guard | init失败 | [FACT] env example未提供键 |
| PG16且本地official image，无预建boundary role | boundary role guard | init失败 | [FACT] compose未见前置creator |
| 所有RDS-like前置满足 | pristine/existing target guard→DDL | 可进入角色/schema创建 | [UNVERIFIED] 仅PG16 fixture设计覆盖，本AU未重放 |

## 2. Outbox 状态

~~~text
unpublished/unclaimed
  └─ claim → unpublished/claimed(until)
       ├─ publisher tx失败 → fail: available_at后移；第8次deadletter/failed_at
       ├─ inbox+jobs提交，mark前崩溃 → lease过期重试→inbox拒绝重复→mark published
       └─ mark published → published终态
~~~

[CONFLICT] 上述状态机实现存在，但正式 target 图没有驱动它的 relay 进程。状态机正确不等于运行链成立。

## 3. Job 状态

| 当前状态 | scoped/identity claim | generic claim | cleanup | 结论 |
| --- | --- | --- | --- | --- |
| queued且available | 可claim→running | 可claim→running | 不处理 | 正常 |
| running且lease未到期 | 不claim | 不claim | 不处理 | 正常 |
| running且lease已到期 | 可重新claim | 不claim | 可重排queued（但cleanup无正式进程） | F-0024 |
| processor成功 | owner条件update→completed | 同左 | 后续30日清理 | 正常 |
| processor失败且未达attempts | owner条件update→queued+backoff | 同左 | 不处理 | 正常 |
| processor失败且达attempts | deadletter+failed同事务 | 同左 | 不处理 | 正常；业务副作用幂等未审 |
| heartbeat失败 | 错误被吞，processor继续 | 同左 | 另一worker可能重领 | [HYPOTHESIS] 需processor专项 |

## 4. Redis 状态

~~~text
idle → start/connect成功 → available
idle → start失败 → degraded + client.destroy
available → get/put/remove异常 → degraded
degraded → 无restart/reconnect边 → 直到进程close/restart
available/degraded → close → CACHE_CLOSED
~~~

该实现把Redis定义为fail-open cache，而不是事实源；F-0028只针对进程生命周期内不能恢复，不把它夸大成数据损坏。

## 5. Local Objects 状态

| 状态/分支 | 持久性 | 清理 | 风险 |
| --- | --- | --- | --- |
| create/append | 仅进程内Map/Buffer | abort或complete删除；进程退出自然丢失 | 无断点续传 |
| complete hash/size失败 | upload仍在Map | 调用方可abort/重试 | 有界内存，服务最大body限制 |
| complete成功 | bytes先写temporary后rename；随后metadata/path分别write | upload Map删除 | bytes原子，metadata/path不是同一事务；崩溃恢复未实现 |
| same digest再次complete | 覆盖同bytes文件与digest metadata | 旧path文件仍指相同ref | F-0027 |
| authorize | 验ref存在后签60–900秒URL | 到期自然失效 | URL host为loopback，F-0025 |
| readAuthorized | expires+HMAC通过才读 | 无服务端撤销表 | 旧token轮换行为未定义 |

## 6. Secret/KMS HTTP 分支

| 入口 | `/health/ready` | 缺/错Bearer | 正确Bearer但越权ref | 正确授权 |
| --- | --- | --- | --- | --- |
| `Handler.ts` 意图实现 | 匿名GET 200 | 401 | 403 | 业务响应 |
| 实际 `Main.ts` | 匿名GET 200 | 继续处理 | 继续处理 | 同业务响应 |

这是同一能力的两个冲突实现。测试覆盖第一行，build/systemd运行第二行，形成F-0021。

## 7. KMS key版本

`LocalKms` 只产生并接受前缀 `local:v1:`，回执恒为 `keyVersion=local-v1`。当前代码没有“current key + historical keyring”的状态分支，也没有rotation/rewrap入口；外部是否永久保存原master为 [UNKNOWN]。
