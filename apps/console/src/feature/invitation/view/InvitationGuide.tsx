import { JourneyGuide } from '@shop/design';

const steps = Object.freeze([
  Object.freeze({ title: '创建邀请', detail: '选择注册新员工或确认现有成员' }),
  Object.freeze({ title: '安全传递', detail: '一次性回执只在创建成功后展示' }),
  Object.freeze({ title: '接收人验证', detail: '统一邀请页核验邀请码和本人身份' }),
  Object.freeze({ title: '注册或进入', detail: '系统按固定范围创建身份或签发会话' }),
]);

export function InvitationGuide() {
  return <JourneyGuide eyebrow="统一闭环" title="每一种邀请都从同一个入口完成" steps={steps} />;
}
