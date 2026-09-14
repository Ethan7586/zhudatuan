# AU-385｜Supabase 登录运行时快速路径

`20260817120000_login_runtime_fast_path.sql` 把每个 active membership 的 runtime 放入 `api_local_login_candidate` 的 entrances 投影，意图避免成功登录后再解析 membership。当前 API 仍在本地密码校验后只读取 entrances 数量；它随后调用 `resolveMembershipRuntimeByIds` 重新发起 runtime RPC，未消费任何 entrances.runtime 字段。

因此数据库仍为每个候选 entrance 计算 runtime，而应用丢弃结果并保留额外 RPC。此为 F-0240（P3）：性能和实现/注释漂移，不改变登录授权结果。主候选 RPC 是当前本地登录的直接契约，归 G0；冗余的 entrances.runtime 子投影列为 G1，禁止在未核验仓外消费者前删除。

未执行登录、测试、数据库写入或线上检查。
