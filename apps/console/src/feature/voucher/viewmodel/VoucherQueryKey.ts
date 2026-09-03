import { NAVIGATION_CATALOG_HASH } from '../../../generated/NavigationBinding';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherView } from '../model/Voucher';

const base = (context: ConsoleContext) => ['console', context.scope.kind, context.scope.id, context.session.accessVersion, NAVIGATION_CATALOG_HASH, 'voucher'] as const;
export const voucherKey = (context: ConsoleContext, view: VoucherView, cursor?: string) => [...base(context), view, cursor ?? null] as const;
export const voucherPrefix = (context: ConsoleContext) => base(context);
