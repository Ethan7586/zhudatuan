begin;

do $$
declare
  suffix text:=substr(replace(gen_random_uuid()::text,'-',''),1,12);
  invitation_id text:='contract:invitation:'||suffix;
  receipt_id uuid:=gen_random_uuid();
  principal_id text:='principal:contract:invitation:'||suffix;
  membership_id text:='membership:contract:invitation:'||suffix;
  member_id text:='member:contract:invitation:'||suffix;
  organization_id constant text:='organization-platform-root';
  issuer_version constant bigint:=1;
  policy_id text;
  terms_hash text;
  grant_digest constant text:=repeat('a',64);
  error_message text;
begin
  insert into identity.principal(id,status,created_at,updated_at,version)
  values(principal_id,'active',clock_timestamp(),clock_timestamp(),0);
  insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
  values(member_id,principal_id,'Invitation contract','active',clock_timestamp(),clock_timestamp(),0);
  insert into access.membership(
    id,member_id,organization_id,client,status,access_version,joined_at,principal_id
  ) values(membership_id,member_id,organization_id,'storefront','active',issuer_version,clock_timestamp(),principal_id);
  select policy.id,policy.terms_hash into strict policy_id,terms_hash
  from identity.registrationpolicy policy
  where policy.effective_at<=clock_timestamp() and (policy.retired_at is null or policy.retired_at>clock_timestamp())
  order by policy.version desc limit 1;

  begin
    insert into identity.preauth(id,transaction_id,principal_id,token_hash,candidate_hash,candidate_memberships,
      browser_hash,expires_at,created_at,purpose,target,reference_id,device_hash,state,version)
    values(gen_random_uuid(),null,principal_id,public.digest('preauth:'||suffix,'sha256'),null,
      jsonb_build_array(jsonb_build_object('id','injected-membership')),public.digest('browser:'||suffix,'sha256'),
      clock_timestamp()+interval '5 minutes',clock_timestamp(),'invitationproof','console',gen_random_uuid()::text,
      public.digest('device:'||suffix,'sha256'),'active',0);
    raise exception 'CONTRACT_INVALID_PREAUTH_SHAPE_ACCEPTED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%preauth_purpose_shape_valid%' then raise; end if;
  end;

  insert into identity.invitation(id,kind,target,organization_id,membership_id,principal_id,recipient_hash,token_hash,
    token_key_version,issuer_membership_id,issuer_access_version,grant_digest,minimum_assurance,max_uses,use_count,
    not_before,expires_at,status,policy_id,terms_hash,reason,created_at,created_by,updated_at,version)
  values(invitation_id,'campaign','storefront',organization_id,null,null,null,public.digest('invitation:'||suffix,'sha256'),
    'contract',membership_id,issuer_version,grant_digest,1,1,1,clock_timestamp()-interval '1 minute',
    clock_timestamp()+interval '1 hour','exhausted',policy_id,terms_hash,'immutable receipt contract',clock_timestamp(),membership_id,
    clock_timestamp(),2);
  insert into identity.invitationreceipt(id,invitation_id,principal_id,membership_id,session_id,assurance,
    issuer_access_version,grant_digest,redeemed_at,trace_id)
  values(receipt_id,invitation_id,principal_id,membership_id,null,2,issuer_version,grant_digest,clock_timestamp(),
    'contract:invitation-receipt:'||suffix);

  begin
    update identity.invitationreceipt set assurance=3 where id=receipt_id;
    raise exception 'CONTRACT_INVITATION_RECEIPT_UPDATE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVITATION_RECEIPT_IMMUTABLE%' then raise; end if;
  end;
  begin
    delete from identity.invitationreceipt where id=receipt_id;
    raise exception 'CONTRACT_INVITATION_RECEIPT_DELETE_ALLOWED';
  exception when others then
    get stacked diagnostics error_message=message_text;
    if error_message not like '%INVITATION_RECEIPT_IMMUTABLE%' then raise; end if;
  end;
end
$$;

rollback;
