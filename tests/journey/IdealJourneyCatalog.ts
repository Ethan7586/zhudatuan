// Generated from config/journeys.yml. Do not edit.
export const IDEAL_JOURNEYS = Object.freeze([
  {
    "id": "J01",
    "title": "密码注册登录",
    "requirements": [
      "MVPIDENTITY"
    ],
    "suite": "identity",
    "scenario": "password registration",
    "assertions": [
      "注册",
      "验证",
      "条款版本",
      "登录",
      "Session",
      "注销"
    ],
    "test": "tests/e2e/identity.spec.ts",
    "status": "required"
  },
  {
    "id": "J02",
    "title": "邀请注册登录",
    "requirements": [
      "MVPIDENTITY"
    ],
    "suite": "identity",
    "scenario": "invitation registration",
    "assertions": [
      "邀请解析",
      "注册或登录",
      "接受",
      "Scope",
      "回跳"
    ],
    "test": "tests/e2e/identity.spec.ts",
    "status": "required"
  },
  {
    "id": "J03",
    "title": "手机验证码",
    "requirements": [
      "MVPIDENTITY"
    ],
    "suite": "identity",
    "scenario": "mobile challenge",
    "assertions": [
      "发送",
      "限速",
      "验证",
      "过期",
      "防枚举"
    ],
    "test": "tests/e2e/identity.spec.ts",
    "status": "required"
  },
  {
    "id": "J04",
    "title": "多成员身份切换",
    "requirements": [
      "MVPIDENTITY"
    ],
    "suite": "identity",
    "scenario": "multiple memberships",
    "assertions": [
      "身份选择",
      "身份切换",
      "权限立即更新",
      "导航立即更新"
    ],
    "test": "tests/e2e/identity.spec.ts",
    "status": "required"
  },
  {
    "id": "J05",
    "title": "联合身份绑定",
    "requirements": [
      "MVPIDENTITY",
      "MVPGROUPSETTING",
      "MVPMALLSETTING"
    ],
    "suite": "identity",
    "scenario": "federation link",
    "assertions": [
      "企业微信或微信绑定",
      "登录",
      "解绑",
      "冲突恢复"
    ],
    "test": "tests/e2e/identity.spec.ts",
    "status": "required"
  },
  {
    "id": "J06",
    "title": "会话与设备撤销",
    "requirements": [
      "MVPIDENTITY"
    ],
    "suite": "identity",
    "scenario": "session devices",
    "assertions": [
      "查看设备",
      "撤销其他会话",
      "Step-up"
    ],
    "test": "tests/e2e/identity.spec.ts",
    "status": "required"
  },
  {
    "id": "J07",
    "title": "创建成员",
    "requirements": [
      "MVPGROUPSETTING",
      "MVPMALLSETTING"
    ],
    "suite": "governance",
    "scenario": "create member",
    "assertions": [
      "创建成员",
      "一次性 Enrollment",
      "首次登录"
    ],
    "test": "tests/e2e/governance.spec.ts",
    "status": "required"
  },
  {
    "id": "J08",
    "title": "成员导入",
    "requirements": [
      "MVPGROUPSETTING",
      "MVPMALLSETTING"
    ],
    "suite": "governance",
    "scenario": "member import",
    "assertions": [
      "上传",
      "预检",
      "提交",
      "部分失败",
      "重试",
      "回读"
    ],
    "test": "tests/e2e/governance.spec.ts",
    "status": "required"
  },
  {
    "id": "J09",
    "title": "角色授权与拒绝",
    "requirements": [
      "MVPGROUPSETTING",
      "MVPMALLSETTING"
    ],
    "suite": "governance",
    "scenario": "role grant deny",
    "assertions": [
      "角色草稿",
      "冲突",
      "预览",
      "执行",
      "权限生效"
    ],
    "test": "tests/e2e/governance.spec.ts",
    "status": "required"
  },
  {
    "id": "J10",
    "title": "所有权转移",
    "requirements": [
      "MVPGROUPSETTING",
      "MVPMALLSETTING"
    ],
    "suite": "governance",
    "scenario": "owner transfer",
    "assertions": [
      "创建",
      "预览",
      "Step-up",
      "接受或取消",
      "审计"
    ],
    "test": "tests/e2e/governance.spec.ts",
    "status": "required"
  },
  {
    "id": "J11",
    "title": "审批模板",
    "requirements": [
      "MVPGROUPSETTING",
      "MVPMALLSETTING",
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER"
    ],
    "suite": "governance",
    "scenario": "approval template",
    "assertions": [
      "新建",
      "修订",
      "启停",
      "版本冻结"
    ],
    "test": "tests/e2e/governance.spec.ts",
    "status": "required"
  },
  {
    "id": "J12",
    "title": "审批任务",
    "requirements": [
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER",
      "MVPGROUPFINANCE",
      "MVPMALLFINANCE",
      "MVPGROUPORDER",
      "MVPMALLORDER",
      "MVPMALLDESIGN"
    ],
    "suite": "governance",
    "scenario": "approval task",
    "assertions": [
      "提交",
      "任务",
      "职责分离",
      "批准或拒绝",
      "Proof消耗"
    ],
    "test": "tests/e2e/governance.spec.ts",
    "status": "required"
  },
  {
    "id": "J13",
    "title": "创建商城",
    "requirements": [
      "MVPGROUPAPPLICATION",
      "MVPMALLSETTING"
    ],
    "suite": "experience",
    "scenario": "create mall",
    "assertions": [
      "Mall Scope",
      "默认应用",
      "主题",
      "入口创建"
    ],
    "test": "tests/e2e/experience.spec.ts",
    "status": "required"
  },
  {
    "id": "J14",
    "title": "复制应用",
    "requirements": [
      "MVPGROUPAPPLICATION",
      "MVPMALLDESIGN"
    ],
    "suite": "experience",
    "scenario": "copy application",
    "assertions": [
      "内容复制",
      "身份不复制",
      "发布不复制",
      "Secret不复制"
    ],
    "test": "tests/e2e/experience.spec.ts",
    "status": "required"
  },
  {
    "id": "J15",
    "title": "商城主题发布",
    "requirements": [
      "MVPGROUPAPPLICATION",
      "MVPMALLDESIGN"
    ],
    "suite": "experience",
    "scenario": "shop theme",
    "assertions": [
      "编辑",
      "预览",
      "发布",
      "多端展示"
    ],
    "test": "tests/e2e/experience.spec.ts",
    "status": "required"
  },
  {
    "id": "J16",
    "title": "团购主题发布",
    "requirements": [
      "MVPGROUPAPPLICATION",
      "MVPMALLDESIGN"
    ],
    "suite": "experience",
    "scenario": "market theme",
    "assertions": [
      "全链路",
      "复用同一组件系统"
    ],
    "test": "tests/e2e/experience.spec.ts",
    "status": "required"
  },
  {
    "id": "J17",
    "title": "政企主题发布",
    "requirements": [
      "MVPGROUPAPPLICATION",
      "MVPMALLDESIGN"
    ],
    "suite": "experience",
    "scenario": "governance theme",
    "assertions": [
      "全链路",
      "资格边界",
      "身份边界"
    ],
    "test": "tests/e2e/experience.spec.ts",
    "status": "required"
  },
  {
    "id": "J18",
    "title": "发布失败恢复",
    "requirements": [
      "MVPGROUPAPPLICATION",
      "MVPMALLDESIGN"
    ],
    "suite": "experience",
    "scenario": "publish recovery",
    "assertions": [
      "CDN失败保旧版",
      "重试",
      "回滚"
    ],
    "test": "tests/e2e/experience.spec.ts",
    "status": "required"
  },
  {
    "id": "J19",
    "title": "商品新建编辑归档",
    "requirements": [
      "MVPGROUPPOOL",
      "MVPMALLPOOL"
    ],
    "suite": "salechain",
    "scenario": "product create edit archive",
    "assertions": [
      "创建",
      "编辑",
      "版本冲突",
      "归档影响"
    ],
    "test": "tests/e2e/salechain.spec.ts",
    "status": "required"
  },
  {
    "id": "J20",
    "title": "商品导入",
    "requirements": [
      "MVPGROUPPOOL",
      "MVPMALLPOOL"
    ],
    "suite": "salechain",
    "scenario": "product import",
    "assertions": [
      "模板",
      "恶意文件",
      "预检",
      "分片",
      "错误文件"
    ],
    "test": "tests/e2e/salechain.spec.ts",
    "status": "required"
  },
  {
    "id": "J21",
    "title": "库存导入",
    "requirements": [
      "MVPGROUPPOOL",
      "MVPMALLPOOL"
    ],
    "suite": "salechain",
    "scenario": "stock import",
    "assertions": [
      "水位",
      "重复批次",
      "账本",
      "可用量"
    ],
    "test": "tests/e2e/salechain.spec.ts",
    "status": "required"
  },
  {
    "id": "J22",
    "title": "经营资格治理",
    "requirements": [
      "MVPGROUPPOOL",
      "MVPMALLPOOL",
      "MVPGROUPSETTING",
      "MVPMALLSETTING"
    ],
    "suite": "salechain",
    "scenario": "qualification",
    "assertions": [
      "登记",
      "发布",
      "到期",
      "撤销",
      "自动阻断"
    ],
    "test": "tests/e2e/salechain.spec.ts",
    "status": "required"
  },
  {
    "id": "J23",
    "title": "报价规则",
    "requirements": [
      "MVPGROUPPOOL",
      "MVPMALLPOOL"
    ],
    "suite": "salechain",
    "scenario": "pricing",
    "assertions": [
      "规则",
      "Offer",
      "舍入",
      "时段",
      "叠加"
    ],
    "test": "tests/e2e/salechain.spec.ts",
    "status": "required"
  },
  {
    "id": "J24",
    "title": "商品池发布",
    "requirements": [
      "MVPGROUPPOOL",
      "MVPMALLPOOL"
    ],
    "suite": "salechain",
    "scenario": "pool publication",
    "assertions": [
      "投池",
      "批量上下架",
      "缺依赖",
      "部分失败"
    ],
    "test": "tests/e2e/salechain.spec.ts",
    "status": "required"
  },
  {
    "id": "J25",
    "title": "匿名消费者购买",
    "requirements": [
      "MVPMALLORDER",
      "MVPMALLPOOL",
      "MVPIDENTITY"
    ],
    "suite": "transaction",
    "scenario": "anonymous purchase",
    "assertions": [
      "浏览",
      "Cart",
      "地址",
      "Quote",
      "Order",
      "Payment"
    ],
    "test": "tests/e2e/transaction.spec.ts",
    "status": "required"
  },
  {
    "id": "J26",
    "title": "福利支付购买",
    "requirements": [
      "MVPPLATFORM",
      "MVPDISTRIBUTION",
      "MVPMALLORDER"
    ],
    "suite": "transaction",
    "scenario": "benefit purchase",
    "assertions": [
      "福利预留",
      "消费",
      "订单完成",
      "账本"
    ],
    "test": "tests/e2e/transaction.spec.ts",
    "status": "required"
  },
  {
    "id": "J27",
    "title": "卡券组合支付",
    "requirements": [
      "MVPMALLORDER",
      "MVPMALLVOUCHER"
    ],
    "suite": "transaction",
    "scenario": "voucher tender",
    "assertions": [
      "Hold",
      "核销",
      "支付分摊",
      "收据"
    ],
    "test": "tests/e2e/transaction.spec.ts",
    "status": "required"
  },
  {
    "id": "J28",
    "title": "迟到支付恢复",
    "requirements": [
      "MVPGROUPORDER",
      "MVPMALLORDER"
    ],
    "suite": "transaction",
    "scenario": "delayed payment",
    "assertions": [
      "超时",
      "迟到回调",
      "恢复",
      "库存和权益处理"
    ],
    "test": "tests/e2e/transaction.spec.ts",
    "status": "required"
  },
  {
    "id": "J29",
    "title": "渠道履约",
    "requirements": [
      "MVPGROUPORDER",
      "MVPMALLORDER",
      "MVPPROVIDER"
    ],
    "suite": "transaction",
    "scenario": "channel fulfillment",
    "assertions": [
      "供应商下单",
      "幂等",
      "物流",
      "回调"
    ],
    "test": "tests/e2e/transaction.spec.ts",
    "status": "required"
  },
  {
    "id": "J30",
    "title": "售后退款",
    "requirements": [
      "MVPGROUPORDER",
      "MVPMALLORDER"
    ],
    "suite": "transaction",
    "scenario": "aftersale refund",
    "assertions": [
      "申请",
      "审批",
      "退货",
      "退款",
      "库存福利佣金冲正"
    ],
    "test": "tests/e2e/transaction.spec.ts",
    "status": "required"
  },
  {
    "id": "J31",
    "title": "外部订单导入",
    "requirements": [
      "MVPGROUPORDER",
      "MVPMALLORDER"
    ],
    "suite": "transaction",
    "scenario": "order import",
    "assertions": [
      "来源证明",
      "重复键",
      "金额",
      "映射",
      "回读"
    ],
    "test": "tests/e2e/transaction.spec.ts",
    "status": "required"
  },
  {
    "id": "J32",
    "title": "凭证批量生成",
    "requirements": [
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER"
    ],
    "suite": "voucher",
    "scenario": "credential generation",
    "assertions": [
      "百万级分片",
      "Secret",
      "Hash",
      "断点",
      "吞吐"
    ],
    "test": "tests/e2e/voucher.spec.ts",
    "status": "required"
  },
  {
    "id": "J33",
    "title": "凭证安全导入导出",
    "requirements": [
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER"
    ],
    "suite": "voucher",
    "scenario": "credential import export",
    "assertions": [
      "加密导入",
      "重复",
      "双人审批",
      "一次性下载"
    ],
    "test": "tests/e2e/voucher.spec.ts",
    "status": "required"
  },
  {
    "id": "J34",
    "title": "备券申请",
    "requirements": [
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER"
    ],
    "suite": "voucher",
    "scenario": "stock request",
    "assertions": [
      "草稿",
      "提交",
      "审批",
      "取消",
      "库存"
    ],
    "test": "tests/e2e/voucher.spec.ts",
    "status": "required"
  },
  {
    "id": "J35",
    "title": "发行订单",
    "requirements": [
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER"
    ],
    "suite": "voucher",
    "scenario": "issue order",
    "assertions": [
      "客户",
      "审批",
      "分批发放",
      "失败重试"
    ],
    "test": "tests/e2e/voucher.spec.ts",
    "status": "required"
  },
  {
    "id": "J36",
    "title": "卡券生命周期",
    "requirements": [
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER"
    ],
    "suite": "voucher",
    "scenario": "lifecycle",
    "assertions": [
      "激活",
      "绑定",
      "解绑",
      "停用",
      "恢复",
      "延期",
      "作废"
    ],
    "test": "tests/e2e/voucher.spec.ts",
    "status": "required"
  },
  {
    "id": "J37",
    "title": "卡券核销退款",
    "requirements": [
      "MVPGROUPVOUCHER",
      "MVPMALLVOUCHER"
    ],
    "suite": "voucher",
    "scenario": "redemption refund",
    "assertions": [
      "Quote",
      "Hold",
      "并发核销",
      "部分退款",
      "时间线"
    ],
    "test": "tests/e2e/voucher.spec.ts",
    "status": "required"
  },
  {
    "id": "J38",
    "title": "财务账单导入",
    "requirements": [
      "MVPGROUPFINANCE",
      "MVPMALLFINANCE"
    ],
    "suite": "finance",
    "scenario": "statement import",
    "assertions": [
      "账单导入",
      "总额",
      "行Hash",
      "重复",
      "Watermark"
    ],
    "test": "tests/e2e/finance.spec.ts",
    "status": "required"
  },
  {
    "id": "J39",
    "title": "对账差异修复",
    "requirements": [
      "MVPGROUPFINANCE",
      "MVPMALLFINANCE"
    ],
    "suite": "finance",
    "scenario": "reconciliation repair",
    "assertions": [
      "匹配",
      "差异",
      "修复审批",
      "冲正",
      "复核"
    ],
    "test": "tests/e2e/finance.spec.ts",
    "status": "required"
  },
  {
    "id": "J40",
    "title": "结算提现发票",
    "requirements": [
      "MVPGROUPFINANCE",
      "MVPMALLFINANCE"
    ],
    "suite": "finance",
    "scenario": "settlement withdrawal invoice",
    "assertions": [
      "结算",
      "调整",
      "提现",
      "发票",
      "恢复",
      "账务守恒"
    ],
    "test": "tests/e2e/finance.spec.ts",
    "status": "required"
  },
  {
    "id": "J41",
    "title": "一期渠道矩阵",
    "requirements": [
      "MVPPROVIDER",
      "MVPDISTRIBUTION"
    ],
    "suite": "channel",
    "scenario": "provider matrix",
    "assertions": [
      "十一扩展配置",
      "健康",
      "同步",
      "下单",
      "退款",
      "账单"
    ],
    "test": "tests/e2e/channel.spec.ts",
    "status": "required"
  },
  {
    "id": "J42",
    "title": "客服会话",
    "requirements": [
      "MVPGROUPSUPPORT",
      "MVPMALLSUPPORT"
    ],
    "suite": "support",
    "scenario": "conversation",
    "assertions": [
      "发起",
      "分配",
      "实时消息",
      "附件",
      "关闭或重开",
      "SLA"
    ],
    "test": "tests/e2e/support.spec.ts",
    "status": "required"
  },
  {
    "id": "J43",
    "title": "范围报表导出",
    "requirements": [
      "MVPGROUPDASHBOARD",
      "MVPGROUPREPORT",
      "MVPMALLDASHBOARD",
      "MVPMALLREPORT"
    ],
    "suite": "reporting",
    "scenario": "scoped report export",
    "assertions": [
      "集团和商城口径",
      "Watermark",
      "快照",
      "导出一致"
    ],
    "test": "tests/e2e/reporting.spec.ts",
    "status": "required"
  },
  {
    "id": "J44",
    "title": "全部可见动作无占位",
    "requirements": [
      "MVPPLATFORM",
      "MVPDISTRIBUTION",
      "MVPGROUPDASHBOARD",
      "MVPGROUPAPPLICATION",
      "MVPGROUPPOOL",
      "MVPGROUPORDER",
      "MVPGROUPVOUCHER",
      "MVPGROUPFINANCE",
      "MVPGROUPREPORT",
      "MVPGROUPSUPPORT",
      "MVPGROUPSETTING",
      "MVPMALLDASHBOARD",
      "MVPMALLDESIGN",
      "MVPMALLPOOL",
      "MVPMALLORDER",
      "MVPMALLVOUCHER",
      "MVPMALLFINANCE",
      "MVPMALLREPORT",
      "MVPMALLSUPPORT",
      "MVPMALLSETTING",
      "MVPIDENTITY",
      "MVPPROVIDER"
    ],
    "suite": "no-placeholder",
    "scenario": "all visible actions",
    "assertions": [
      "六端全部入口",
      "全部可见动作",
      "无占位",
      "无假成功",
      "无死链"
    ],
    "test": "tests/e2e/no-placeholder.spec.ts",
    "status": "required"
  }
] as const);
export type IdealJourney = (typeof IDEAL_JOURNEYS)[number];
export type IdealJourneyId = IdealJourney['id'];
