# AU-153｜Partner、Store 与供应关系深审

Partner module 管理 partner/store；Store 地址在持久化前经 KMS envelope。SupplierRelationshipPort 为供应关系及合同保存有 predecessor 的版本链，Order/Checkout 真实读取其状态。

新增 F-0182/P2：缺少 API/port 行为测试。未发现 P0。
