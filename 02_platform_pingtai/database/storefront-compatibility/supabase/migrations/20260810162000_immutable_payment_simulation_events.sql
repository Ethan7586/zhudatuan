-- Simulation transactions and point ledgers are event facts, not mutable
-- balances. Wallets/vouchers remain mutable by design; their mutations are
-- reconstructed from these immutable event records and audit_logs.
drop trigger if exists payment_simulations_immutable_update on public.payment_simulations;
create trigger payment_simulations_immutable_update
before update or delete on public.payment_simulations
for each row execute function public.reject_immutable_change();

drop trigger if exists test_point_ledgers_immutable_update on public.test_point_ledgers;
create trigger test_point_ledgers_immutable_update
before update or delete on public.test_point_ledgers
for each row execute function public.reject_immutable_change();
