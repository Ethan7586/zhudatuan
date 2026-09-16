# RV-0003｜Secret Store 与 KMS 工作负载授权独立复核

## 边界与方法

- 固定审计基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`。
- 从 production systemd → bundled entry source → runtime child map → HTTP handler → policy parser/测试重新追踪。没有读取环境文件、secrets catalog、Bearer、master key 或调用内部端口。
- 授权 Handler 的测试只被用来确认预期契约，不能代替对实际 Main 接线的判断；实际接线由 source/build/service 三方交叉确认。

## 独立事实链

1. `zhudatuan-internal-runtime.service:1-20` 在 production、`registration-only` profile 下启动 `InternalRuntimeMain.js`；`sfl-secret-store@.service:1-20` 还可独立启动 `LocalSecretsMain.js`。两者都是正式 protected process/运行入口。
2. `04_tools/scripts/build-commerce.mjs:10-20` 将 `localinfra/Run.ts`、`localsecrets/Main.ts`、`localkms/Main.ts` 分别编译为对应的 production bundle；固定基线不提交 dist，故没有把缺失构建产物冒充运行证据。
3. `localinfra/Run.ts:4-30` 与 `RuntimeEntries.ts:1-15` 在 production `registration-only` profile 明确启动 `localsecrets/Main.ts`、`localkms/Main.ts` 的 bundle。
4. `localsecrets/Main.ts:5-25` 与 `localkms/Main.ts:5-33` 直接从路径/body 读取 ref/keyRef 后返回 secret 或调用加/解密：除 health 外没有读取 `Authorization`，没有 authenticate/require，也没有加载 workload policy。
5. 同目录 `Handler.ts` 的两个授权实现则会在解析路径/body 前 authenticate，并对 exact ref/keyRef require；测试覆盖了缺 Bearer 的 401 和越权资源的 403。`WorkloadAccessPolicy.ts:82-147` 还实现了 full-staging policy 的 workload/resource 精确映射。
6. full-staging unit 虽将 `workload-access-policy` 作为 credential 注入，并传入 `LOCAL_WORKLOAD_ACCESS_POLICY_FILE`，但仍运行同一个 `InternalRuntimeMain.js`；全仓对该环境变量的读取只到 config 解析，未发现任何 Main 将其装配到上述 Handler。因而 policy 文件存在不等于生产 handler 实际执行授权。

## 裁决

- **F-0021 确认 P1，高置信度。** 已部署入口绕过仓库已有的 workload authentication 与逐资源授权设计；可到达本机 loopback TLS 端口的进程不必携带有效 bearer 即可请求已知 secret ref 或 KMS keyRef。该边界失效可导致凭据泄露或受保护字段被解密。
- 没有尝试访问、枚举或解密任何资源，因此实际可达进程集合、历史滥用、具体暴露值和外网可达性均为 UNKNOWN。
- 不是 P0：未发现正在进行的严重数据/安全事故，且网络隔离与进程隔离的实际部署状态没有在本轮验证。

## 后续独立修复批次的最小范围

1. 从修复时最新 `zdt-next` 建立单目的安全接线分支，只让两个 production Main 装配现有授权 Handler 与正确 profile policy。
2. 以隔离 TLS fixture 覆盖 health 200、无/错误 token 401、正确 token+允许资源 200、正确 token+越权资源 403；断言拒绝发生在 catalog/KMS 使用之前，日志不输出值。
3. 分别验证 `registration-only` 与 `full-staging`，再检查每个 systemd 单元环境/credential 的最小权限；不在同一批替换加密原语、KMS master key、secret catalog 或服务用户。
4. 回滚仅回退入口接线提交；不得为回滚而轮换或恢复任何密钥值。

本复核没有修复、读取凭据、部署、推送、合并或改变线上状态。
