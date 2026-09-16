# AU-276｜ScopeResolver 深审

ScopeResolver接口要求actor、operation、resource/hint；Pg实现先要求membership消费上下文，再向`access.resolve_session_scope`传递realm/client/organization等全部边界，并对node actor绑定scope node context。无P0–P3新问题。
