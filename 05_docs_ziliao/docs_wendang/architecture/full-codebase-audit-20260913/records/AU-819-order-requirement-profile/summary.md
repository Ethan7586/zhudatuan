# AU-819｜订单需求 Profile 解析与确定性投影

- 审阅范围：`OrderRequirementProfile.ts`（377 行）、测试（73 行）及已审order.yml/Authority/Workbook依赖。
- 结论：Profile 校验workbook row count、固定OMS-001..014、profile/chain、existing operation的requirements backlink、planned operation尚未注册、existing证据存在、Designed/Missing不带伪证据；`uiRouteEvidence`被强制校验并写入trace/evidence。测试声明ID、operation、evidence一致性和两次YAML字节一致，且比较当前生成order.yml。
- 测试未执行（Vitest缺失）；generate会写制品，未运行。两文件均为 **G0**，无新 finding。
