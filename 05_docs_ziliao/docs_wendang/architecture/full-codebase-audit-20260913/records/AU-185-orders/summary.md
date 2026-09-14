# AU-185｜Commerce API order/after-sale writes 深审

订单、售后、发货、支付和退款均在服务端scope、phone assurance、幂等和审计证据边界内调用RPC。除下单phone/cart测试外，关键写入缺少direct fixture，记录F-0194/P2；未发现P0。
