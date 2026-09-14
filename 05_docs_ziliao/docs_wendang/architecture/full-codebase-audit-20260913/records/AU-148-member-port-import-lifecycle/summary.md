# AU-148｜Member public port、开通升级与导入异步链深审

MemberPort 负责 invitation/profile、成员节点注册与 Hosted/sovereign database-function 边界；HTTP actions 从受信任的 access node context 提供 authority。主 jobs catalog 注册 `memberimport` consumer，导入以 staged rows、每行 savepoint、500 行 continuation 和 report completion 实现恢复链。

发现 F-0179/P2：完整 MemberModule 和 Identity Registration selected module 均以同名 read action 覆盖带 `projectImport` finalize 的 import-read action。已完成导入报告不能得到授权下载投影，响应会保留内部 object reference metadata。未发现 P0。
