# AU-101｜Identity 凭据、密码与成员重置操作链路深审

成员重置受 exact owner、expected version、scope、近期 password assurance 与 owner protection 约束。操作锁定所有 password subject，撤销会话、ticket、challenge、credential、角色和 grant；帐号/成员历史记录保留为已重置状态，最后发布 outbox event。

password change/verify/reset 都绑定当前或请求 realm account。普通变更和 reset 更新 credential version 并撤销其他或全部 session；平台 owner 路径交给受控 rotation function。

结论：未发现 P0–P3 新问题。Vitest 未安装，未执行。
