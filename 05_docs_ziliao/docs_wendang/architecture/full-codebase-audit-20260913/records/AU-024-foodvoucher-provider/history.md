# AU-024 历史取证

- `582f37fe`祖先树包含Foodvoucher专用Catalog/Price实现：固定`/couponrecharge/coupon_saas_api/get_product_lists`、`code/msg/data` mapper、金额精度与畸形字段测试，manifest为`foodvoucher.v2`且只声明Catalog/Price。
- 后续基线收口把Provider/Mapper/tests选择为通用模板分支，仅保留一行Mapper和ID/签名测试；`33bf835e`再把secretRefs改为适配通用Client/Webhook，但没有补业务契约测试。
- 这解释了当前README与代码分裂的来源；不把祖先实现直接认定为应恢复方案，后续仍需核最新供应商协议。
