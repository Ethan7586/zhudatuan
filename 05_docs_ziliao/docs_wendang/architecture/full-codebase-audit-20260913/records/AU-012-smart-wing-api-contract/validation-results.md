# AU-012 定向验证结果

| 验证入口 | 结果 | 可证明 | 不可证明 |
| --- | --- | --- | --- |
| 固定基线文件/blob核对 | 11文件/758行一致 | AU范围与基线内容 | 仓外副本 |
| permission集合复算 | 86 code=86 definitions，唯一；risk 23/6/32/25 | 目录闭合 | 产品风险分级正确 |
| taxonomy闭包探针 | 65 code唯一；1个dangling L2 | F-0064固定事实 | 线上商品数量 |
| delivery evidence解析 | 7条中4条路径缺失 | F-0063路径断裂 | 仓外副本 |
| 正式checker静态反追 | 不读取delivery matrix | 闸门脱节 | 外部CI是否另读 |
| runtime mutation探针 | code/risk/platform/数组均可改 | F-0032扩展 | 生产已有mutation |
| payment映射探针 | 11×8矩阵符合源码顺序 | 当前纯函数语义 | 产品期望 |
| 本包workspace test/typecheck | 均Missing script | 无独立入口 | 4测试真实结果 |
| 根test静态拓扑 | Storefront include两个测试文件 | 可间接发现4用例 | 依赖未安装的通过/失败 |
| npm run check:delivery | 缺yaml，加载前退出 | 当前审计环境依赖缺失 | checker业务结果 |

没有安装依赖、运行全仓测试/完整构建、数据库重放或浏览器；没有修改任何被审代码或线上状态。
