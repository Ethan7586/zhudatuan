# 组织层级实施设计

## 目标

在不破坏现有 tenant 隔离和生产查询的前提下，支持平台、分销、集团、商城和部门的祖先范围继承。

## 数据结构

### `org_units`

| 字段                       | 含义                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `id`                       | 稳定组织节点 ID                                                  |
| `tenant_id`                | 安全租户；平台根和跨租户分销节点允许为空                         |
| `parent_id`                | 直接父节点                                                       |
| `kind`                     | platform / tenant / distributor / enterprise / mall / department |
| `code`、`name`             | 节点展示与业务编码                                               |
| `source_type`、`source_id` | 旧业务表的唯一映射                                               |
| `status`                   | active / disabled                                                |

### `org_unit_closure`

| 字段            | 含义                   |
| --------------- | ---------------------- |
| `ancestor_id`   | 祖先节点               |
| `descendant_id` | 后代节点               |
| `depth`         | 自身为0，直接子节点为1 |

闭包表让权限查询用一次索引命中完成祖先包含判断，避免逐层递归和每增加一级就修改 `ResourceScope`。

## 安全边界

- 平台范围可以命中所有后代，但只能从数据库中受保护的范围绑定获得。
- 分销范围可以命中自己名下集团及后代；真实启用前保持 fail closed。
- tenant、enterprise、mall、department 不得借组织路径跨 tenant。
- `orgUnitPath` 只由服务端依据资源行和闭包表构造。
- 老的平铺字段保留用于兼容；新路径不能使旧授权范围变宽。

## 一致性

- 数据迁移回填后运行 `api_org_unit_path` 验证每个旧实体都有唯一祖先链。
- 旧实体映射使用 `(source_type, source_id)` 唯一约束。
- 节点移动使用独立存储过程，在事务内重建相应闭包边。
- 本期不开放通用节点移动接口。
