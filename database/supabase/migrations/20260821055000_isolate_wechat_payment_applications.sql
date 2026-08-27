begin;

alter table payment.attempt
  add column scene text check(scene in('miniapp','jsapi')),
  add column application_hash char(64) check(application_hash is null or application_hash~'^[0-9a-f]{64}$');

alter table payment.attempt
  add constraint payment_attempt_application_required check(
    (scene is not null and application_hash is not null)
    or (scene is null and application_hash is null and state in('succeeded','failed'))
  );

create index payment_attempt_application on payment.attempt(application_hash,intent_id,requested_at desc)
  where application_hash is not null;

comment on column payment.attempt.scene is 'miniapp or Official Account JSAPI application used for the provider order';
comment on column payment.attempt.application_hash is 'SHA-256 of the immutable WeChat AppID, never the AppID itself';

commit;
