# AU-188｜Commerce API permission admin 深审

权限中心把读取PII、角色/范围授予与成员状态变更分开授权；自我提权/停用在route层拒绝，最终范围上限由数据库RPC验证。成员状态成功分支缺少direct fixture，记录F-0197/P2；未发现P0。
