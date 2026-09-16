# AU-119｜Channel ExternalMapping 领域模型深审

`ExternalMapping` 在价格、库存同步记录被投影前验证 provider、对象类型、外部/内部标识与源版本；SKU 的实际持久化解析由 CatalogSourcePort 完成。其 identity getter 没有仓内直接消费者，但构造器处在生产同步路径，不属垃圾代码。

未发现 P0–P3；无独立模型测试。
