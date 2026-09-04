# 宏泰甄选半月内测数据集

该数据集可用于本地内测，也可通过专用命令导入与当前迁移兼容的目标数据库。固定标识为
`internal_hongtai_20260817_20260831_v1`，时间范围为
2026-08-17 00:00:00 至 2026-08-31 23:59:59（Asia/Shanghai）。默认随机种子为 `20260817`，
默认生成 700 笔订单。

## 隔离边界

- 数据库：`zhudatuan_internal_hongtai_20260817_20260831`
- 本地 Docker 容器：`zhudatuan-internal-hongtai-postgres`
- 对外连接：仅允许 `localhost`、`127.0.0.1` 或连接目标为本机的私有 Docker 网络
- 数据标识：`itht:`、`ITHT-`、`MOCK-*`、`[内测]`
- 外部支付、供应商、物流和卡券全部为确定性 Mock，不发起真实网络调用
- Seed 写入前校验数据库名、用户、服务器地址、端口、迁移状态和非内测订单数量
- 所有阶段在同一事务内完成；失败会整体回滚
- 不生成登录凭据、会话或测试管理员角色；合成会员仅保留 `role:self`
- Mock 连接全部为 `disabled`，Outbox/Inbox 均写成历史已处理状态

正式迁移在空数据库中原样回放。生产测试导入命令不修改 migration、ledger、`replayprovider` 或其他
目标库基线记录，也不调用清理逻辑、不停用 immutable trigger。仅本地重建命令会在已通过本地身份断言的
临时数据库事务内清理既有同数据集记录，并在删除财务测试记录时短暂停用三个既有 immutable trigger。

当前运行时没有可用于“固定历史时间 + 批量完整闭环”的 Seed/import 应用入口，且 API 受下述模块契约
不一致阻断。因此生成器直接写入既有 schema，但没有只改订单状态：它同时生成 checkout、订单行、
支付 tender/effect、权益扣减与返还、库存 movement、Outbox、履约、售后、退款、财务借贷、对账、
报表和外部 Mock 幂等事实；财务流水复用现有 `finance.post` 函数。该取舍仅存在于 `04_tools/tools/seed/**`。

## 数据证据

只读取了内层七份宏泰导出表的字段、数量级、日期/状态/支付比例和金额计算关系；外层七份副本已逐个
确认字节相同，因此未重复统计。真实姓名、手机号、地址、用户 ID、订单号、券码、流水号和客户名称
均未进入生成器、数据库或报告。验证程序通过合成命名空间白名单证明记录不是原样导入。

## 命令

以下命令均从仓库根目录执行：

```bash
npm run local:dataset:seed -- \
  --dataset internal_hongtai_20260817_20260831_v1 \
  --orders-target 700 --days 15 --seed 20260817 \
  --database zhudatuan_internal_hongtai_20260817_20260831 \
  --host 127.0.0.1 --port 55432

npm run local:dataset:verify -- \
  --dataset internal_hongtai_20260817_20260831_v1 \
  --orders-target 700 --days 15 --seed 20260817 \
  --database zhudatuan_internal_hongtai_20260817_20260831 \
  --host 127.0.0.1 --port 55432

npm run local:dataset:cleanup -- \
  --dataset internal_hongtai_20260817_20260831_v1 \
  --orders-target 700 --days 15 --seed 20260817 \
  --database zhudatuan_internal_hongtai_20260817_20260831 \
  --host 127.0.0.1 --port 55432
```

`--orders-target`、`--days` 和 `--seed` 可调整；每天至少一单。默认 700 单时，逐日曲线严格为：

```text
32,36,40,43,45,60,58,38,42,46,48,52,56,54,50
```

## 标记测试数据导入

导入方通过进程环境提供 `POSTGRES_USER`、`POSTGRES_PASSWORD`，并显式给出目标数据库、主机和端口；
命令不读取仓库中的本地密码引用，也不会输出凭据或 DSN：

```bash
npm run dataset:import:test -- \
  --dataset internal_hongtai_20260817_20260831_v1 \
  --orders-target 700 --days 15 --seed 20260817 \
  --database <目标数据库完整名称> \
  --host <目标数据库主机> --port <目标数据库端口>
```

该命令只在目标 schema 已完成正式迁移时执行，所有写入位于同一事务。它不会删除目标库任何现有记录；
目标库没有该数据集时执行插入，完整数据集已存在时输出 `IMPORT_NOOP`，检测到同命名空间的残缺数据时
停止并回滚。目标数据库须由正式 migration 创建并保持规范 owner；不能通过改变数据库 owner 的方式复制 schema。
导入后使用同一组显式目标参数运行验证：

```bash
npm run dataset:verify:test-import -- \
  --dataset internal_hongtai_20260817_20260831_v1 \
  --orders-target 700 --days 15 --seed 20260817 \
  --database <目标数据库完整名称> \
  --host <目标数据库主机> --port <目标数据库端口>
```

验收要求是包括 `production_import_safety`、金额、库存和财务在内的全部检查 PASS。

直接销毁整个临时数据库（完整库名，无模糊匹配）：

```bash
docker exec zhudatuan-internal-hongtai-postgres \
  psql -U shopadmin -d postgres -v ON_ERROR_STOP=1 \
  -c 'drop database zhudatuan_internal_hongtai_20260817_20260831 with (force);'
```

## 验证范围

独立验证命令输出逐项 `PASS`/`FAIL`，覆盖数据库身份、领域数量、每日曲线、订单与订单行、支付、
退款上限、状态时间、库存、卡券/核销防重、外部回调幂等、权益余额、财务借贷、日报、报表、
商品可见性、优惠券资格、退款场景覆盖、金额等式、5% 服务费舍入、合成标识、内测标记、稳定幂等键，
以及不存在测试凭据、测试管理员权限、活动 Mock 连接和待处理运行时消息。

已实际执行两次同参数 Seed：两次均为 700 单、1,262 行，第二次没有增加记录；已执行一次清理演练，
所有数据集主记录和依赖记录均归零，之后重新 Seed 恢复最终数据。

## 当前 API 验收状态

之前的 API 启动失败来自旧工作树服务源码与主工作区较新 `@shop/contract` 依赖混用，不能据此判定
`finance` 存在产品缺口。数据库验证已经完成，API 200、页面数据渲染和浏览器金额核平仍属于尚未完成的
验收项；应在源码、依赖和 migration 位于同一提交后重新执行。
