export function isManagementRole(role: Readonly<{ id?: string; role?: string; name: string }>): boolean {
  const id = role.id ?? role.role ?? '';
  return id !== 'role:self'
    && !id.startsWith('role-zhudatuan-storefront-member')
    && role.name !== '商城会员';
}
