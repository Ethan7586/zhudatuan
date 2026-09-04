import { NAVIGATION_CATALOG_HASH } from '../../../generated/NavigationBinding';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { VoucherChoiceKind, VoucherProgressKind, VoucherView } from '../model/Voucher';

const base = (context: ConsoleContext) => ['console', context.scope.kind, context.scope.id, context.session.accessVersion, NAVIGATION_CATALOG_HASH, 'voucher'] as const;
export const voucherKey = (context: ConsoleContext, view: VoucherView, cursor?: string, query?: string, state?: string) => [...base(context), view, cursor ?? null, query ?? null, state ?? null] as const;
export const voucherDetailKey = (context: ConsoleContext, view: VoucherView, id: string) => [...base(context), 'detail', view, id] as const;
export const voucherChoicesKey = (context: ConsoleContext, kind: VoucherChoiceKind) => [...base(context), 'choices', kind] as const;
export const voucherFacetsKey = (context: ConsoleContext, query?: string, state?: string) => [...base(context), 'facets', query ?? null, state ?? null] as const;
export const voucherNumberKey = (context: ConsoleContext, number: string) => [...base(context), 'number', number] as const;
export const voucherTimelineKey = (context: ConsoleContext, id: string) => [...base(context), 'timeline', id] as const;
export const voucherProgressKey = (context: ConsoleContext, kind: VoucherProgressKind, id: string) => [...base(context), 'progress', kind, id] as const;
export const voucherPrefix = (context: ConsoleContext) => base(context);
