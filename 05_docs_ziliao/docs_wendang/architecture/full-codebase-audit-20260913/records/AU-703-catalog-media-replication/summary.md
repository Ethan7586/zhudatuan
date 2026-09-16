# AU-703｜Catalog 媒体复制

- 审阅范围：`20260912210000_catalog_media_replication_persistence.sql`、`20260912250000_grant_catalog_media_replication_job.sql`、Catalog source projection、media replication/register/persistence、queue processor、Jobs runtime 与相关测试。
- 审阅方式：深入审阅外部图片进入队列、对象复制验证、media/product 持久化、cover URL 发布、重试与并发；同构 storage/fixture 测试按结构性审阅。

## 审计结论

- **G0：保留。** 该链把外部 Catalog 图片复制到配置对象存储 target，逐副本保存 upload/verify 状态；只有全部 required targets完成才绑定 product media并发布 cover URL。Job runtime显式注册 `catalogmediareplication`，并以 `shopjob` 角色、scope和启动前权限检查运行。
- [FACT][E-AU-703-001] Source projection 生成按 product+source URL集合去重的 job；processor下载第一个可用 source，注册/验证 primary replica后写 product `attributes.coverUrl`。失败会交由 QueueJob retry，未完成复制不会发布 URL。
- **F-0286：P2。** Image path只校验“非空字符串”，job对每个值直接 `fetch`，未限制 scheme、host、DNS/IP、redirect、response size或content type。受污染/恶意的 provider catalog payload可把 job worker 变为访问内部网络或非预期 endpoint的请求器。
- **F-0287：P2。** source 图片改变时会创建不同 job id，而媒体 worker并发为2；旧/新 job可以并行。两者共享按 product+purpose确定的 media id，且 binding、media row和 product cover write没有 source version/CAS/active-job guard，后完成的旧 job可覆盖更新后的封面与 media binding。

## 未验证项

- 定向 Vitest命令因固定基线缺少 `vitest` executable而未启动（exit 127）；未安装依赖或改动测试环境。
- 未读取生产 egress policy、object storage实际 target、Cake provider payload治理或 runtime.job claim implementation；因此不主张已发生 SSRF或过期封面。

## 结论等级

- 新增问题：F-0286（P2，中高置信度，需要独立安全复核）；F-0287（P2，高置信度，需要独立复核）。无 P0。
- 垃圾代码：G0 1 项；不新增 G1/G2/G3/GX。
- 二次复核：是；须以隔离 worker模拟允许与禁止 URL/redirect/IP、max-size，并强制两个不同 source job逆序完成，验证最终仅最新 source可发布。
