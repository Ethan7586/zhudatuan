import { z } from 'zod';

export const MemberInvitationInputSchema = z.object({
  label: z.string().trim().min(2, '请输入至少 2 个字的邀请标识').max(80, '邀请标识不能超过 80 个字'),
  destination: z.string().trim().min(8, '请输入有效手机号').max(32, '请输入有效手机号')
    .regex(/^\+?[0-9][0-9\s()-]{6,30}[0-9]$/, '请输入有效手机号'),
});

export const MemberInvitationReceiptSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  code: z.string().min(1),
  target_client: z.literal('operator'),
  max_uses: z.literal(1),
  expires_at: z.iso.datetime(),
  status: z.string().min(1),
}).passthrough();

export type MemberInvitationInput = z.infer<typeof MemberInvitationInputSchema>;
export type MemberInvitationReceipt = z.infer<typeof MemberInvitationReceiptSchema>;
