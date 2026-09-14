# AU-022｜Vendor Core 外部供应商传输内核

## 1. 边界与覆盖

- 固定源码基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`；开工检查点 CP-21 `a4979ce7`。
- 覆盖 `01_core_hexin/extensions/vendors/core` 11/11 文件、365/365 行，全部深入审阅；沿生产链核对Provider Core、JD/Tmall/Wanlian/Wenxuan/Cakeuncle消费者、Channel connection创建/更新、secret读取、extension installation和权限目录。
- 范围包括连接校验、Header/HMAC/RSA认证、通用HTTP客户端、deadline/重试/限流/并发/断路器、错误投影、测试与公共入口。
- 没有连接供应商、secret store、数据库或线上服务，没有安装依赖、构建、修复、删除、推送、合并或部署。

## 2. 真实架构

[FACT][E-AU-022-002/003] `@shop/vendorcore`随Commerce OCI运行，不拥有进程或数据库。Channel operator以critical permission创建/更新connection，输入base URL、endpoint map和secret ref；服务读取secret并持久化installation，RuntimeExtensionLoader装配具体vendor authenticator和VendorClient。

[FACT][E-AU-022-004] VendorClient对每个connection维护独立RateLimiter、Semaphore和CircuitBreaker；请求受context/connection双deadline约束，GET和带业务幂等键的写可按策略重试，无幂等键的写只发一次。HMAC/RSA签名覆盖method/path/timestamp/nonce/body，redirect被拒绝。

## 3. 主要结论

- [P1-CANDIDATE][E-AU-022-005/006] connection base URL只要求`https:`，未禁止userinfo、私网/回环/链路本地目标，也未绑定provider Manifest或批准host。拥有`channel.connection.manage`的operator可提交任意HTTPS origin和secret ref，后续health/业务请求会带真实provider认证证明及业务正文发往该origin，形成F-0096/RV-0014。权限为critical且需正常授权是缓解，不消除目的地完整性缺口；线上配置未读，故不是P0。
- [P1-CANDIDATE][E-AU-022-007] 通用VendorClient直接`response.text()`，没有Content-Length、流式字节上限或嵌套深度限制；JD/Tmall/Wanlian/Wenxuan等共享链可被异常provider响应放大内存并由递归JSON检查继续消耗栈，形成F-0097/RV-0015。Cakeuncle专用客户端已有2MiB限长，证明并非底层统一控制。
- [P3][E-AU-022-008] 4个测试只覆盖未声明operation、503读重试、无幂等键写不重试和503断路器；没有base URL目的地、真实HMAC/RSA头、connection/response/deadline超时、body上限、畸形/深层JSON、带幂等键写和取消传播反事实，形成F-0098。
- [G1][E-AU-022-009] `HeaderAuthenticator`固定源码只在Vendor Core/Provider Core测试中使用，所有生产vendor使用HMAC/RSA或专用Cakeuncle认证。因仍是公共export且仓外consumer未排除，列DC-0027/G1，不能删除。

本AU新增P1候选2项、P3 1项；累计P0 0、P1候选13、P2 46、P3 38、NIT 1。新增G1 1项；累计G0 2、G1 23、G2 2、G3 0、GX 2。

## 4. 验证与未知

- 正式 `npm test -- --reporter=dot` 与 `npm run typecheck` 均因固定工作树缺`vitest`/`tsc`在源码加载前以127退出；未安装依赖。
- 静态数据流确认API输入的baseUrl/secretRef进入installation，运行时直接组成`new URL(path, baseUrl)`并附加auth headers；没有其它host allowlist或Manifest绑定。
- 全包检索确认通用Client没有响应字节上限；Cakeuncle专用`readLimited`是独立实现，不能保护本Client。
- [UNKNOWN] 线上connection目的地、secret-store对ref的服务端ACL、出网策略、DNS解析约束、provider响应尺寸和进程内存限制；本AU未访问。
