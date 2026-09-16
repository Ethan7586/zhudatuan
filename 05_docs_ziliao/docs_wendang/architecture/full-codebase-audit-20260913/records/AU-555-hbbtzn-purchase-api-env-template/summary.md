# AU-555｜hbbtzn L1 purchase API 环境模板

- 审阅范围：`02_platform_pingtai/config/node-runtime/hbbtzn-l1/purchase-api.env.example`（22 行）；定向核对 hbbtzn deployment、remote release policy 与 domain-boundary consumer。
- 审阅方式：环境契约、node domain/secret binding 与发布入口人工追踪；未启动 API 或读取支付/订单数据。

## 真实运行关系

purchase env 预期绑定 L1 storefront origins、DB/quote/KMS/Secret Store/WeChat payment refs 和 node manifest；但 hbbtzn deployment 将 purchase responsibility 绑定 `sfl-purchase-api@zhudatuan-l0.service`，remote policy 只将 PurchaseApi artifacts/pointer/health check 配置到 L0。domain-boundary gate 将本模板作为 L1 purchase environment input 检查其 origins/ref/pointer namespace。

## 审计结论

- **F-0260 补强（P2）**：模板通过 L1 manifest data scope/secret/payment namespace 的静态设计是自洽的，但与实际 L0-only purchase artifact/restart topology 不一致。直接按 L1 template cutover 会缺少 L1 candidate target；继续运行 L0 又不消费这些 L1 refs。
- `API_ALLOWED_ORIGINS` 正好为 hbbtzn 的四个 storefront host，不含 console/identity；所有 bearer/key value为 placeholder。不能仅依据配置文件判断付款、报价或会话真实行为。

## 未验证项

- 未执行 purchase deployment check（其只覆盖 L0 legacy template）、未验证 L0 delegation、quote signing/KMS/WeChat callback scope、实际 domain routing或未来 L1 cutover。
