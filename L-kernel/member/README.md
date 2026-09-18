# 会员能力迁入清单

状态：会员与节点的纯规则源码已纳入本包；本次主线候选尚未把现有后端的会员接口接回这些实现。会员登记、节点关系和档案主体仍以原模块为准。

现有实现位置：

- 节点与父链模型：`01_core_hexin/packages/config/src/SflNodeKernel.ts`。
- L6～L11 会员节点注册：`organization.register_hosted_member_node` 数据库函数及现有身份注册调用。
- 商城会员目录、详情及其他接口：`01_core_hexin/services/commerce/src/modules/member/`。
- 目录 SQL 读取器：`MemberDirectoryReader.ts`，仍属现有服务的接入层，不是内核领域代码。

目标中的第一个共用业务切片是会员的登记、所属节点与父链、档案和本店会员关系。L0、L1、H6 将逐步使用同一实现与测试样例，各自绑定自己的 Realm 和数据库；OP、手机／微信登录、订单和四流状态不混进会员核心。MB 全域码只作身份展示，真实关系继续使用完整 ID。

目前会员注册已能创建独立 Realm／节点，但不能据此认定“每个 MB 独立物理数据库”已经落地。此项需要单独的节点数据库开通与本店目录投影接线，不能靠复制会员 SQL 完成。
