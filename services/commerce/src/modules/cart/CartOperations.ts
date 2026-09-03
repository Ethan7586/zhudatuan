import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, integerField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function cartOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('cart', pool, context.container.get(AUDIT_SINK), {
    'cart.current.read': async (request, database) => {
      const access = requireAccess(request);
      const result = await database.query(`select cart.id,cart.mall_id,cart.application_id,cart.version,cart.updated_at,
        coalesce(jsonb_agg(jsonb_build_object('listing',item.listing_id,'sku',item.sku_id,'quantity',item.quantity,'version',item.version,
          'title',listing.title) order by item.listing_id) filter(where item.listing_id is not null),'[]') items
        from access.web_member_context($1,$2) owned
        left join cart.cart cart on cart.member_id=owned.id and cart.mall_id=owned.organization_id and cart.state='active'
        left join cart.item item on item.cart_id=cart.id left join catalog.listing listing on listing.id=item.listing_id
        group by cart.id`, [access.membership.id, access.actor.session]);
      return { status: 200, body: result.rows[0] ?? { items: [], version: 0 } };
    },
    'cart.items.put': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const quantity = integerField(body, 'quantity', 0);
      const listing = request.input.path.listingid!;
      const target = await database.query<{ member_id: string; mall_id: string; application_id: string }>(`select owned.id member_id,owned.organization_id mall_id,application.id application_id
        from access.web_member_context($1,$2) owned
        join organization.organization mall on mall.id=owned.organization_id and mall.kind='mall'
        join experience.application application on application.scope_id=mall.id and application.status='active'
        order by application.updated_at desc limit 1`, [access.membership.id, access.actor.session]);
      const owner = target.rows[0];
      if (!owner) throw new Error('ACTIVE_MALL_APPLICATION_MISSING');
      const active = await database.query<{ sku_id: string; version: number }>(`select sku_id,version from catalog.listing where id=$1 and scope_id=$2 and status='published'
        and (effective_at is null or effective_at<=clock_timestamp()) and (expires_at is null or expires_at>clock_timestamp())`, [listing, owner.mall_id]);
      const item = active.rows[0];
      if (!item) throw new Error('LISTING_NOT_PURCHASABLE');
      const cart = await database.query<{ id: string }>(`insert into cart.cart(id,member_id,mall_id,application_id,state,version,updated_at)
        values($1,$2,$3,$4,'active',0,clock_timestamp()) on conflict(member_id,mall_id,application_id) where state='active'
        do update set updated_at=clock_timestamp() returning id`, [`cart:${randomUUID()}`, owner.member_id, owner.mall_id, owner.application_id]);
      const id = cart.rows[0]!.id;
      if (quantity === 0) await database.query('delete from cart.item where cart_id=$1 and listing_id=$2', [id, listing]);
      else await database.query(`insert into cart.item(cart_id,listing_id,sku_id,quantity,listing_version,version) values($1,$2,$3,$4,$5,0)
        on conflict(cart_id,listing_id) do update set quantity=excluded.quantity,sku_id=excluded.sku_id,listing_version=excluded.listing_version,version=cart.item.version+1`,
      [id, listing, item.sku_id, quantity, String(item.version)]);
      const result = await database.query('update cart.cart set version=version+1,updated_at=clock_timestamp() where id=$1 returning *', [id]);
      return rowResult(result);
    },
    'cart.items.batch': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      if (!Array.isArray(body.items) || body.items.length > 100) throw new Error('VALIDATION_FAILED:items');
      for (const entry of body.items) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('VALIDATION_FAILED:items');
        const item = entry as Record<string, unknown>;
        const listing = String(item.listing ?? '');
        const quantity = item.quantity;
        if (!listing || !Number.isSafeInteger(quantity) || (quantity as number) < 0) throw new Error('VALIDATION_FAILED:items');
        if (quantity === 0) await database.query(`delete from cart.item where cart_id in(select cart.id from cart.cart cart
          join access.web_member_context($1,$2) owned on owned.organization_id=cart.mall_id and owned.id=cart.member_id
          where cart.state='active') and listing_id=$3`, [access.membership.id, access.actor.session, listing]);
        else await database.query(`update cart.item set quantity=$4,version=version+1 where cart_id in(select cart.id from cart.cart cart
          join access.web_member_context($1,$2) owned on owned.organization_id=cart.mall_id and owned.id=cart.member_id
          where cart.state='active') and listing_id=$3`, [access.membership.id, access.actor.session, listing, quantity]);
      }
      const result = await database.query(`update cart.cart set version=version+1,updated_at=clock_timestamp() where id in(select cart.id from cart.cart cart
        join access.web_member_context($1,$2) owned on owned.organization_id=cart.mall_id and owned.id=cart.member_id
        where cart.state='active') returning *`, [access.membership.id, access.actor.session]);
      return rowResult(result);
    },
  });
}
