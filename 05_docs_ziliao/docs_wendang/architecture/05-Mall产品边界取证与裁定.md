# Mall 产品边界取证与裁定

> 裁定时间：2026-09-02 02:01 +08:00
>
> 正式名称：`zhudatuan 主打团`
>
> 取证范围：原仓库、WCHS `backend-reconstruction@2ebf2ed`、阿里云当前 release

## 一、最终结论

不能说“整个代码少了一层”。更准确的事实是：

1. 原仓库、WCHS 和阿里云都把**整套仓库或整份 release**当作商城产品运行面；前端、Commerce 后端、API 和数据库本来就在同一商城产品中。
2. 三者都没有把这个产品边界稳定命名为一个显式的 `Mall Product` 架构节点，因此架构图阅读时容易把 `zhudatuan`、Mall 和 Commerce 压成同一层。
3. 代码里的 `MallContext`、`mall_id` 和组织树 `Mall` 表达的是当前商城身份与数据范围，即 **Mall Scope**；它们不是前端、后端和 API 的产品父级。
4. 因此当前缺的是**显式所有权与架构登记层**，不是凭空缺少一整套可执行代码。

现在正式裁定：`zhudatuan 主打团` 是平台与品牌根；商城系统 Mall 是完整产品系统；Storefront、Console、Auth、Miniapp、Commerce API、Commerce Kernel、Jobs、合同和数据层全部属于 Mall。

## 二、原仓库证据

取证工作区：`/Users/Ethan/Desktop/Projects/zhudatuan/main@dbb5bbb`。

- README 原定义直接把整个工程称为面向企业福利消费的多层级商城平台。
- 物理结构是 `apps/*`、`services/commerce`、`services/commerce-api`、`database/*`，没有统一的产品级 `products/mall` 外壳。
- `services/commerce/src/modules` 下已有 `order`、`checkout`、`inventory`、`benefit`、`voucher`、`reporting` 等模块。
- `ethan/mall-001-mall-context@e44d18a` 新增的 `services/commerce/src/modules/mall/MallContext.ts` 只从 Scope 和 Membership 解析 `mall_id`。
- `ethan/mall-phase1-integration@a93433b` 只比该 Mall Context 多一个集成提交。

所以原仓库已经有商城产品的全部组成，也已经补过商城身份，但没有把“Mall 产品父级”和“Mall 数据 Scope”明确分名。

## 三、WCHS 证据


WCHS README 把正式运行面定义为：

- 三个客户端：Auth、Console、Storefront。
- 一个 `services/commerce`：唯一 API、Jobs、Migration 与 Smoke 运行时。
- 一份 PostgreSQL Migration 事实源。

WCHS 的 `services/commerce/src/modules` 同样直接包含 Order、Checkout、Inventory、Benefit、Voucher、Reporting 等模块，没有产品级 `modules/mall` 父目录。WCHS 文档中的 Mall 主要出现在组织层级：

```text
Platform → Tenant → Enterprise → Mall / Department
```

订单表中的 `mall_id` 和安全 Scope 也是租户商城身份，不是产品代码父级。

结论：WCHS 也没有缺商城功能；它同样把整个仓库作为商城产品，只是没有显式命名 `Mall Product Boundary`。WCHS 继续只读，不因本裁定被改写。

## 四、阿里云证据

2026-09-02 02:01 +08:00 只读检查实例 `i-2zeewhay0farxq8lucrd`：

```text
/opt/zhudatuan/current
→ /opt/zhudatuan/releases/0d9bcb13e8a-console-perf95-stable
```

当前 release 同时包含：

```text
apps/
├── auth-web
├── console
├── miniapp
└── storefront-web

services/
├── commerce
└── commerce-api
```

`services/commerce/src/modules` 直接包含 Order、Checkout、Inventory、Payment、Reporting 等领域模块，没有 `modules/mall`。这证明生产同样把“前端 + API + 后端”作为一份商城产品 release 运行，而不是缺失这些层。

阿里云 current 是不可变发布证据，不在服务器原地改名或改源码。旧 release 中出现的旧品牌名称只能由修正后的源码构建新 release 后替换。

## 五、正式层级

```text
zhudatuan 主打团
├── 平台控制面
│   ├── 商城创建
│   ├── 平台配置
│   ├── 统一运营与治理
│   └── 基础设施与发布治理
└── 商城系统 Mall
    ├── 前端体验
    │   ├── Storefront
    │   ├── Console
    │   ├── Auth
    │   └── Miniapp
    ├── 合同与 SDK
    ├── Commerce API
    ├── Commerce Backend / Jobs
    ├── Canonical Data
    └── Commerce 交易域
        ├── Checkout
        ├── OMS 订单管理系统
        ├── Inventory
        ├── Payment / Fulfillment
        ├── Benefit / Voucher
        └── Reporting / Support 等协作模块
```

OMS 的父级链正式固定为：

```text
zhudatuan 主打团 → 商城系统 Mall → Commerce 交易域 → OMS 订单管理系统
```

Checkout、Inventory、Benefit、Voucher、Reporting 与 OMS 协作，但不是 OMS 的父级。

## 六、两种 Mall 必须分名

| 名称 | 含义 | 典型实现 |
|---|---|---|
| Mall Product | 产品所有权边界，拥有前端、API、后端、合同和数据层 | 架构清单、Release Manifest、Ownership Catalog |
| Mall Scope | 某个租户商城的身份与数据范围 | `MallContext`、`mall_id`、Organization Scope |

任何后续文档或代码评审不得再用一个“Mall”同时代指这两个概念。

## 七、品牌名称冻结

正式产品名称只有：

```text
zhudatuan 主打团
```

任何旧中文写法、繁体写法或不带 `zhudatuan` 前缀的简称，都不再作为当前产品名称。WCHS 与阿里云旧 release 中的旧文字仅保留为不可变历史证据，不得反向污染新主轴。
