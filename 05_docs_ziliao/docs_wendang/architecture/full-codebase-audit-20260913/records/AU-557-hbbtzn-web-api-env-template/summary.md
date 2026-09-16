# AU-557｜hbbtzn L1 Web Business API 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/web-api.env.example`（21 行）；定向核对 hbbtzn deployment 与 remote policy。
- 审阅方式：环境契约、public mall mapping与发布入口人工追踪；未启动 API 或执行商业数据请求。

## 真实运行关系

Web Business env 预期以 L1 node manifest/DB/KMS/secret refs 服务 console/storefront origins，并将四个 hbbtzn storefront host 映射至 `zdt-l1-verify` public mall。现行 hbbtzn deployment 与 remote policy 的 `web-api` responsibility、candidate artifact、pointer/restart 都仅指向 zhudatuan-l0。

## 审计结论

- **F-0260 补强（P2）**：L1 Web API environment 的 domain/mall/data binding 自洽，但没有 L1 delivery target；现行路径运行 L0 web-api 将不使用该模板定义的 hbbtzn DB/ref/pointer，直接以其启用会缺少对应 artifact。
- 所有 KMS/Secret Store bearer 均为 placeholder。`PUBLIC_MALL_HOST_MAPPINGS` 与 storefront template/registry 的四个 hbbtzn hosts 相同，未发现本文件内 store mapping 漂移。

## 未验证项

- 未验证 WebBusinessApi runtime 对 host mapping 的实际解析、L0 delegation、RLS/DB scope、CORS、KMS/secret binding、真实 hbbtzn API route或未来 L1 deployment decision。
