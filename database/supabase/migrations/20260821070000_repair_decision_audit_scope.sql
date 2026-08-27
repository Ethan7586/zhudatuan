begin;

drop policy appscope on access.decisionaudit;
create policy appscope on access.decisionaudit for all to shopapp
using((scope_id is null and actor_id=nullif(current_setting('app.actor_id',true),'')) or access.scope_allowed(scope_id))
with check((scope_id is null and actor_id=nullif(current_setting('app.actor_id',true),'')) or access.scope_allowed(scope_id));

insert into runtime.schemaversion(version,checksum)
values('20260821070000','2fc8035f1cc3b97c662e3920092f27878079750eabfb51bd75e81e9c06186d9f');

do $assert$ begin
  if (select count(*) from pg_policies where schemaname='access' and tablename='decisionaudit' and policyname='appscope')<>1
    then raise exception 'DECISION_AUDIT_SCOPE_POLICY_MISSING'; end if;
end $assert$;

commit;
