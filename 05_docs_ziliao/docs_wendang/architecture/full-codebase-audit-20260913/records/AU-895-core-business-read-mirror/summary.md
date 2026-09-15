# AU-895｜核心业务读镜像架构审阅

- 审阅日期：2026-09-15
- 基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`CORE-BUSINESS-READ-MIRROR.md`，1 个文件、225 行。
- 方法：主样本审阅读镜像边界、缓存契约/失效、安全、已落地声明与阶段计划；复用 AU-172 的缓存客户端证据，核对当前 source、兼容性部署残留和受控 release policy，不重复审缓存客户端实现。

## 结论

文件的单一交易真相、缓存不得参与支付/核销判定、缓存故障回源等原则仍与 AU-172 现行 client 行为一致。当前 `coreReadCache` client 对 loopback/令牌/超时/信封进行约束，且失效不会阻塞目录响应。

但“已落地的第一段”称独立 `services/core-read-cache` 和缓存服务已经完成；当前源码树未见该服务实现，只有 `commerce-api` client 与 `storefront-compatibility` 下可选 PM2 sidecar 配置，现行受控 release policy 未列该服务。文件也没有当前消费者。记录 F-0346（P3）；它是历史/目标读镜像方案，归 DC-0133（G1），不得删除、启动兼容性 PM2、配置 Tair 或按本文部署。

未运行缓存、服务、发布、数据库、Tair、OSS 或云控制面，未修改业务代码、配置、测试、工作流、迁移或运行资源。
