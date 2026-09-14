# AU-023｜Cakeuncle Vendor 深审

- 固定基线：`5a1ce71eebbefaa826368a9e1dc17730f9363bc4`
- 范围：`01_core_hexin/extensions/vendors/cakeuncle`
- 覆盖：16/16文件、662/662行深入审阅。
- 运行链：Cake/Flower/Foodvoucher/Meal provider factory → `createCakeuncleClient` → connection级限流/并发/断路器 → Cakeuncle HTTPS API；包随Commerce OCI发布，无独立进程或数据库。

## 结论

- F-0099/P2：2MiB响应限额没有JSON深度/节点预算；约5,000层、30KiB的合法JSON可触发递归`RangeError`，被误投影为可重试Transport失败并计入断路器。
- F-0100/P1候选：包文档明确禁用Foodvoucher写入与Webhook，但生产Foodvoucher factory通过通用`createPorts`重新暴露order/cancel/refund/statement/verification/webhook；协议、签名与回调能力不闭合。
- F-0101/P3：源码直接依赖`@shop/contract`类型，但package只声明`@shop/vendorcore`，隔离类型检查依赖工作区提升/传递依赖。
- F-0102/P3：测试覆盖签名向量、基础Client和被禁用Webhook，但不验证生产export、Foodvoucher实际ports、深度限额和完整超时/取消矩阵。
- DC-0028/GX：未导出的Cakeuncle Webhook与H5/Card签名保存唯一不安全协议边界，禁止直接删除并进入RV-0017。
- DC-0029/G1：Cakeuncle专名Rate/Circuit别名、Signer类和部分endpoint常量在固定仓内无生产caller，但仍为公共export，证据不足以删除。

## 保留设计

- Client对响应流实施2MiB硬限额，非幂等写入遇到不确定Transport结果不会重试。
- 签名比对使用`timingSafeEqual`；请求认证字段不包含channelKey。
- Cake/Flower/Meal对真实endpoint与业务scope另做闭合检查，且当前公开barrel刻意不导出Webhook。

## 验证状态

- 正式`npm test -- --reporter=dot`与`npm run typecheck`均因审计工作树缺`vitest`/`tsc`在源码加载前退出127；未安装依赖、未build。
- 合成Node探针：1,000层JSON对象通过；5,000/10,000/20,000层分别在30,004/60,004/120,004字节触发`RangeError: Maximum call stack size exceeded`。
- 未连接Cakeuncle、secret store、数据库或线上运行单元；没有修复、删除、推送、合并或部署。
