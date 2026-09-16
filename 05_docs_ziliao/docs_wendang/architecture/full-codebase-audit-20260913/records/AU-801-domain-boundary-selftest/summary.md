# AU-801｜SFL 节点域边界自检

- 审阅范围：`check/domain-boundary.test.mjs`（32 行）及其已审 verifier 的直接反例接口。
- 审阅方式：逐项阅读4个测试的输入篡改和预期错误码；执行正式 Node test 入口。

## 审计结论

- 正式自检 **4/4 通过**：验证当前 L0/L1 registry、无默认节点、重复 host 拒绝、未知 node resource binding 拒绝。
- 该测试会调用完整 verifier，后者还静态核对节点 runtime manifest、环境模板、allowed origins、secret namespace及重复真相源；但没有请求真实 DNS、阿里云、KMS或运行 API。因此证明的是固定基线配置投影一致性，非线上部署健康。
- 文件由 `check:identity-nodes` 直接调用，具有独立反例契约，定为 **G0**；无新 finding。
