-- The initial simulation migration is already applied to the test project.
-- Preserve the explicit bank simulation channel in the underlying payment log.
alter table public.payments drop constraint if exists payments_channel_check;
alter table public.payments add constraint payments_channel_check check (channel in ('welfare', 'meal', 'wechat', 'alipay', 'unionpay', 'bank', 'manual', 'voucher', 'points'));
