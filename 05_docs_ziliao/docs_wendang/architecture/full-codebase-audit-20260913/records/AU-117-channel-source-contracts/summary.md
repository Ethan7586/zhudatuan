# AU-117｜Channel Catalog/Price/Stock/Statement 公共源类型契约深审

四个文件均为 `@shop/contract` provider source 类型的 type-only re-export。它们由 ChannelModule/index 作为稳定公共 API 传出；运行时的同步 Worker 直接使用下游 Catalog、Pricing、Inventory、Finance 端口。

仓内没有直接消费者，但外部 SDK/extension 编译契约未被静态检索覆盖，因此归类 G0，禁止按“零代码引用”删除。未发现 P0–P3。
