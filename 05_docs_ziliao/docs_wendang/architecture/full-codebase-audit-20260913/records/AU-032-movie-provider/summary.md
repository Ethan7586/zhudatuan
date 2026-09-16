# AU-032｜Movie Provider 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/providers/movie`
- 覆盖：9/9文件、79/79行深入审阅。
- 运行链：Channel/Fulfillment jobs → Registry → MovieProvider → Wanlian VendorClient（返回`MovieMapper`、`createWanlianClient`）。

## 结论

- F-0130/P1候选：`manifest`声明了`Catalog/Price/Inventory/Logistics`外部能力对接名，但电影能力使用`Cinema/Show/SeatLock/Issue`命名；Channel/Fulfillment在运行时仍调用标准`Catalog/Price/Inventory/Statement/Order/tracking`能力，`Extensions.require`将因能力不匹配使`catalog/price/stock/tracking`链路拒绝。
- F-0131/P2候选：`Issue/SeatLock/Cinema`属于`manifest`能力池内未见固定caller与专用port映射，当前仅`show/seat/order`等operation字符串内聚于`Provider.ts`，`operations`命名与能力词汇边界未形成同一契约。
- F-0132/P3：唯一测试只核required provider ID与签名，不实例化factory、不覆盖`catalog/price/stock/order/tracking/statement/verification`等业务port，也不覆盖上述能力语义映射。
- DC-0040/G1：`mapMovieError`仅有本包内声明，仓内静态检索零caller；但barrel公开导出、仓外兼容路径未排除，不能直接删除。

## 保留设计

- providerFactory注册、manifest签名策略、`MovieMapper`与Wanlian客户端链路在架构上完整；`movie`是required provider，不能凭静态零caller推定删除。
- `MovieProvider`的`createWanlianClient`、`createPorts`与通用`channel`调用模型保持与其他provider一致，主要问题在能力口径归一，而非调用框架本身。

## 验证状态

- test/typecheck因缺vitest/tsc在该工作区退出127；未执行build。
- 反事实已确认：`manifest`能力词汇与Channel/Fulfillment标准caller集合有不一致，`catalog/price/inventory/logistics`可达性不能成立。
- 未访问线上installation、未调用真实供应商、未进行数据库迁移/线上写入。
