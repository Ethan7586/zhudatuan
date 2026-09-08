import { bindPasswordChange, bindSessionRead, bindSessionsRead, bindSessionsRevoke } from '@shop/sdk/identity';
import { bindAddressesManage, bindAddressesRead, bindFavoritesPut, bindFavoritesRead, bindProfileRead } from '@shop/sdk/member';
import { connectMiniappClient, defineMiniappFeature } from '../../../shared/FeatureViewModel';
import type { OperationOutputFor } from '@shop/contract';
import { actionField, requiredText } from '@shop/presentation/actions';
import { randomToken } from '../../../platform/Random';
import { displayItem, displayPage } from '../../../shared/Display';

export const accountViewModel = defineMiniappFeature({
  defaultRoute: 'miniappprofile', routes: ['miniappprofile', 'miniappsecurity'], title: '我的', description: '管理个人资料、地址、收藏和安全入口。',
  connect: (executor) => connectMiniappClient({
    identity: { passwordChange: bindPasswordChange(executor), sessionRead: bindSessionRead(executor), sessionsRead: bindSessionsRead(executor), sessionsRevoke: bindSessionsRevoke(executor) },
    member: {
      addressesManage: bindAddressesManage(executor), addressesRead: bindAddressesRead(executor), favoritesPut: bindFavoritesPut(executor),
      favoritesRead: bindFavoritesRead(executor), profileRead: bindProfileRead(executor),
    },
  }),
  read: async (client, context, route) => {
    if (route.id === 'miniappsecurity') {
      const [session, sessions] = await Promise.all([client.identity.sessionRead({}, context), client.identity.sessionsRead({ query: { limit: 30 } }, context)]);
      return Object.freeze({ session, sessions });
    }
    const [profile, addresses, favorites] = await Promise.all([
      client.member.profileRead({}, context),
      client.member.addressesRead({ query: { limit: 50 } }, context),
      client.member.favoritesRead({ query: { limit: 100 } }, context),
    ]);
    return Object.freeze({ profile, addresses, favorites });
  },
  actions: (value, route) => route.id === 'miniappsecurity' ? securityActions(value) : profileActions(value),
  project: (value, route) => {
    if (route.id === 'miniappsecurity') {
      const source = value as SecuritySnapshot;
      return displayPage(source.sessions.items.map((item) => displayItem(item.id, item.current ? '当前设备' : item.deviceLabel, item.current ? '正在使用本次登录' : '可单独退出这台设备', item.current ? 'active' : 'available', item.lastSeenAt)));
    }
    const source = value as ProfileSnapshot;
    return displayPage(
      [displayItem(source.profile.id, source.profile.display_name, source.profile.mobile_bound ? '手机号已绑定' : '尚未绑定手机号', source.profile.status, source.profile.joined_at)],
      source.addresses.items.filter(({ status }) => status === 'active').map((item) => displayItem(item.id, item.recipient_masked, `${item.mobile_masked} · ${item.address_masked}`, item.is_default ? 'default' : item.status)),
      source.favorites.items.map((item) => displayItem(item.listingId, '收藏商品', item.available ? '当前仍可购买' : `暂不可用：${item.unavailableReason ?? '商品状态已变化'}`, item.available ? 'available' : 'unavailable', item.createdAt))
    );
  },
  execute: async (client, context, route, value, action, input) => {
    if (route.id === 'miniappsecurity') {
      const source = value as SecuritySnapshot;
      if (action.id === 'password') {
        await client.identity.passwordChange({ body: { currentPassword: requiredText(input, 'currentPassword', 128), newPassword: requiredText(input, 'newPassword', 128) } }, context);
        return { message: '登录密码已更新。' };
      }
      const revoked = /^revoke:(\d+)$/.exec(action.id);
      const session = revoked === null ? undefined : source.sessions.items[Number(revoked[1])];
      if (session === undefined || session.current) throw new Error('MINIAPP_SECURITY_SESSION_INVALID');
      await client.identity.sessionsRevoke({ path: { sessionid: session.id }, body: {} }, context);
      return { message: '所选设备的登录状态已撤销。' };
    }
    const source = value as ProfileSnapshot;
    if (action.id === 'address') {
      const id = `address:${await randomToken(32)}`;
      await client.member.addressesManage({ path: { addressid: id }, body: {
        recipient: requiredText(input, 'recipient', 100), mobile: requiredText(input, 'mobile', 32), region: requiredText(input, 'region', 100),
        address: requiredText(input, 'address', 500), is_default: input.default === 'yes', status: 'active',
      } }, context);
      return { message: '收货地址已保存。' };
    }
    const removedAddress = /^addressdelete:(\d+)$/.exec(action.id);
    if (removedAddress !== null) {
      const address = source.addresses.items[Number(removedAddress[1])];
      if (address === undefined || address.status !== 'active') throw new Error('MINIAPP_ADDRESS_INVALID');
      await client.member.addressesManage({ path: { addressid: address.id }, body: { status: 'deleted' } }, context);
      return { message: '收货地址已删除。' };
    }
    const removedFavorite = /^favorite:(\d+)$/.exec(action.id);
    if (removedFavorite !== null) {
      const favorite = source.favorites.items[Number(removedFavorite[1])];
      if (favorite === undefined) throw new Error('MINIAPP_FAVORITE_INVALID');
      await client.member.favoritesPut({ path: { listingid: favorite.listingId }, body: { favorite: false } }, context);
      return { message: '商品已取消收藏。' };
    }
    throw new Error('MINIAPP_ACCOUNT_ACTION_INVALID');
  },
});

interface ProfileSnapshot {
  readonly profile: OperationOutputFor<'member.profile.read'>;
  readonly addresses: OperationOutputFor<'member.addresses.read'>;
  readonly favorites: OperationOutputFor<'member.favorites.read'>;
}

interface SecuritySnapshot {
  readonly session: OperationOutputFor<'identity.session.read'>;
  readonly sessions: OperationOutputFor<'identity.sessions.read'>;
}

function profileActions(value: unknown) {
  const source = value as ProfileSnapshot;
  return [
    Object.freeze({ id: 'address', label: '新增收货地址', description: '地址只用于履约，页面展示会保持脱敏。', tone: 'primary' as const, expectedVersion: 0, fields: [
      actionField('recipient', '收货人', { maximumLength: 100 }), actionField('mobile', '手机号', { maximumLength: 32 }),
      actionField('region', '省市区', { placeholder: '例如：上海市/上海市/浦东新区', maximumLength: 100 }), actionField('address', '详细地址', { maximumLength: 500 }),
      actionField('default', '设为默认地址', { kind: 'choice', choices: [{ value: 'yes', label: '是' }, { value: 'no', label: '否' }] }),
    ] }),
    ...source.addresses.items.flatMap((item, index) => item.status === 'active' ? [Object.freeze({ id: `addressdelete:${index}`, label: `删除地址 ${item.recipient_masked}`, description: `${item.region_code} · ${item.address_masked}`, tone: 'danger' as const, expectedVersion: item.version, confirmation: '确认删除这个收货地址？', fields: [] })] : []),
    ...source.favorites.items.map((item, index) => Object.freeze({ id: `favorite:${index}`, label: '取消一项收藏', description: item.available ? '该商品当前仍可查看。' : `当前不可用：${item.unavailableReason ?? '原因待更新'}`, tone: 'secondary' as const, fields: [] })),
  ];
}

function securityActions(value: unknown) {
  const source = value as SecuritySnapshot;
  return [
    ...(source.session.security.hasLocalCredential ? [Object.freeze({ id: 'password', label: '修改登录密码', description: '新密码需符合统一安全策略；密码不会写入页面缓存。', tone: 'primary' as const, expectedVersion: source.session.accessVersion, identityScope: true, confirmation: '确认修改登录密码？修改后请使用新密码登录。', fields: [
      actionField('currentPassword', '当前密码', { kind: 'password', maximumLength: 128 }), actionField('newPassword', '新密码', { kind: 'password', maximumLength: 128 }),
    ] })] : []),
    ...source.sessions.items.flatMap((item, index) => item.current ? [] : [Object.freeze({ id: `revoke:${index}`, label: `退出 ${item.deviceLabel}`, description: `最近使用：${new Date(item.lastSeenAt).toLocaleString('zh-CN')}`, tone: 'danger' as const, expectedVersion: source.session.accessVersion, identityScope: true, confirmation: '确认让这台设备退出登录？', fields: [] })]),
  ];
}
