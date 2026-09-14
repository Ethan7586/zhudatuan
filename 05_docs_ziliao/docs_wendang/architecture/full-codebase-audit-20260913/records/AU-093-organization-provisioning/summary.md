# AU-093｜Organization provisioning port 与商城创建链路深审

MallOrganizationProvisioningPort 在创建前取得以 scope/parent/code 为键的事务 advisory lock，随后确认平台可见的 active enterprise 或 mall parent，并拒绝既有 sourcebinding。创建按 organization、unitclosure、sourcebinding 顺序完成。

CreateMall 将这项创建与 catalog pool、experience application/binding、mall owner 创建放在同一 operation 编排。共享 OrganizationPort 由 Identity 读取组织 kind，及 Channel 管理 distributor 生命周期。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
