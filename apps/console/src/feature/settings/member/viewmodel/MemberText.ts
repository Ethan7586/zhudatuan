import { chineseDomainLabel } from '@shop/presentation';

const membershipStates: Readonly<Record<string, string>> = Object.freeze({ invited: '待加入', active: '正常', suspended: '已暂停', left: '已离开' });

export function memberStatusText(value: string): string {
  return membershipStates[value] ?? chineseDomainLabel(value);
}
