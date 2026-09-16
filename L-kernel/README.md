# L-kernel

这是 `zdt-next` 中共用 L-kernel 的逐步迁入目录，不是第二套节点模型或新的公共契约。现有 L0～L11 节点、关系与 Realm 事实仍以 `01_core_hexin/packages/config/src/SflNodeKernel.ts` 及现有数据库实现为准。

目标是让 L0（zhudatuan）、L1（hbbtzn）、L2（H6）使用同一份业务实现；各节点只绑定自身的节点清单、Realm、数据库和必要的业务画像。OP 管理内核与 L-kernel 平行，不随会员业务迁入。

迁入按业务能力逐项进行。旧接口在对应能力迁入时接到共用实现，旧实现随后收口；不能同时留下两份写入事实。HTTP、SQL、外部服务和部署配置属于适配层，不因共用而搬进纯业务核心。首个能力见 [会员迁入清单](member/README.md)。

本目录已作为私有工作区包 `@shop/l-kernel` 接入构建。第一个真实接点是会员自定义档案的纯规则：现有后端继续提供原接口，由 `src/member/MemberProfileRules.ts` 复用配置和字段值规则。它不改运行时路由，不代表节点数据库或整套会员能力已迁入。

节点差异日后可由简短 JSON 描述，但节点、Realm 与数据库的真实绑定必须沿用现有权威数据；本目录不复制一套虚构的 L0/L1/H6 节点清单。
