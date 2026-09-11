import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('主打团供应网络迁移', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite({ extensions: { pgcrypto } });
    await database.exec(fixtureSchema);
    const migration = await readFile(resolve(process.cwd(), '../../../02_platform_pingtai/database/supabase/migrations/20260912120000_create_zhudatuan_supplier_network.sql'), 'utf8');
    await database.exec(migration);
    const analytics = await readFile(resolve(process.cwd(), '../../../02_platform_pingtai/database/supabase/migrations/20260912130000_create_supplier_analytics_perspective.sql'), 'utf8');
    await database.exec(analytics);
  });

  afterAll(async () => database.close());

  it('assigns existing ordinary and cake products to two visible suppliers', async () => {
    const result = await database.query<{ name: string; products: number }>(`select partner.name,count(product.id)::integer products
      from partner.partner partner left join catalog.product product on product.owner_partner_id=partner.id
      group by partner.id,partner.name order by products desc`);
    expect(result.rows).toEqual([
      { name: '主打团供应商', products: 11 },
      { name: '蛋糕叔叔供应链', products: 1 },
    ]);
  });

  it('creates ten priced and stocked 1–2 yuan products', async () => {
    const result = await database.query<{ products: number; minimum: number; maximum: number; stocked: number }>(`select
      count(distinct product.id)::integer products,min(price.amount_minor)::integer minimum,
      max(price.amount_minor)::integer maximum,count(distinct stock.sku_id)::integer stocked
      from catalog.product product join catalog.sku sku on sku.product_id=product.id
      join pricing.price price on price.sku_id=sku.id join inventory.stockitem stock on stock.sku_id=sku.id
      where product.category_id='category:zdt-daily-trial'`);
    expect(result.rows[0]).toEqual({ products: 10, minimum: 100, maximum: 199, stocked: 10 });
  });

  it('publishes live agreement, price, inventory and value metrics', async () => {
    const result = await database.query<{ network: { facets: { suppliers: Array<Record<string, unknown>> } } }>(
      "select catalog.console_supply_network('mall:d1708f04df2dd8a61736852c4900fb43') network",
    );
    expect(result.rows[0]?.network.facets.suppliers[0]).toMatchObject({
      label: '主打团供应商', productCount: 11, skuCount: 11, trialProductCount: 10,
      agreementStatus: 'active', contractRef: 'ZDT-SUPPLY-DIRECT-2026', channel: '主打团自营货盘',
    });
  });

  it('calculates supplier sales, fulfillment and settlement from real business records', async () => {
    await database.exec(`
      insert into ordering.orderrecord values('order:1','mall:d1708f04df2dd8a61736852c4900fb43','paid','processing','none',clock_timestamp(),clock_timestamp());
      insert into ordering.line values('line:1','order:1','sku:ordinary','product:ordinary','普通商品',2,1980,'主打团自营货盘','partner:supplier:zhudatuan');
      insert into finance.settlement values('settlement:1','mall:d1708f04df2dd8a61736852c4900fb43','partner:supplier:zhudatuan',1500,'payable',null,clock_timestamp(),null);
    `);
    const cockpit = await database.query<{ value: { operations: Record<string, number>; sales: Record<string, number> } }>(
      "select reporting.cockpit('mall:d1708f04df2dd8a61736852c4900fb43','partner:supplier:zhudatuan','30days') value",
    );
    expect(cockpit.rows[0]?.value.sales.periodSalesCents).toBe(1980);
    expect(cockpit.rows[0]?.value.operations).toMatchObject({ pendingFulfillmentCount: 1, payableSettlementCents: 1500 });
    const fulfillment = await database.query<{ dimensions: { label: string }; value: number }>(
      "select dimensions,value from reporting.supplier_metric_rows('mall:d1708f04df2dd8a61736852c4900fb43','partner:supplier:zhudatuan','fulfillment','30days')",
    );
    expect(fulfillment.rows).toEqual([{ dimensions: expect.objectContaining({ label: '履约中' }), value: 1 }]);
  });
});

const fixtureSchema = `
  create extension if not exists pgcrypto;
  create role zhudatuanidentityapi; create role zhudatuanwebapi; create role anon; create role authenticated;
  create role service_role; create role shopapp; create role shopjob; create role shopread;
  create role zhudatuanidentityjob; create role zhudatuanbootstrap; create role zhudatuansandboxbootstrap;
  create schema access; create schema organization; create schema partner; create schema catalog;
  create schema pricing; create schema inventory; create schema ordering; create schema finance; create schema reporting; create schema runtime;
  create function access.scope_allowed(text) returns boolean language sql stable as 'select true';
  create table organization.organization(id text primary key,kind text not null,name text not null);
  create table partner.partner(id text primary key,scope_id text not null,kind text not null,name text not null,status text not null,
    version bigint not null,created_at timestamptz not null,updated_at timestamptz not null);
  create table partner.agreement(id text primary key,partner_id text not null,mall_id text not null,contract_ref text not null,
    contract_hash char(64) not null,capabilities jsonb not null,effective_at timestamptz not null,expires_at timestamptz,status text not null);
  create table catalog.category(id text primary key,parent_id text,code text not null unique,name text not null,status text not null,sort_order integer not null);
  create table catalog.product(id text primary key,owner_partner_id text,brand_id text,category_id text not null,title text not null,
    product_type text not null,attributes jsonb not null,status text not null,version bigint not null,created_at timestamptz not null,updated_at timestamptz not null);
  create table catalog.sku(id text primary key,product_id text not null,code text not null unique,specifications jsonb not null,status text not null,version bigint not null);
  create table catalog.listing(id text primary key,scope_id text not null,pool_id text,sku_id text not null,title text not null,status text not null,
    effective_at timestamptz,expires_at timestamptz,version bigint not null,created_at timestamptz not null,updated_at timestamptz not null,unique(scope_id,sku_id));
  create table catalog.poolbinding(mall_id text not null,pool_id text not null,status text not null,effective_at timestamptz,primary key(mall_id,pool_id));
  create table catalog.sourcelisting(id text primary key,provider text not null,external_id text not null,object_type text not null,sku_id text,
    scope_id text not null,source_version text not null,source_payload jsonb not null,source_hash char(64) not null,status text not null,observed_at timestamptz not null);
  create table catalog.suppliercategory(id text primary key,supplier_id text not null,source_code text,source_name text not null,category_id text not null,
    state text not null,confidence numeric not null,created_at timestamptz not null,updated_at timestamptz not null);
  create table pricing.pricebook(id text primary key,scope_id text not null,currency char(3) not null,name text not null,status text not null,version bigint not null);
  create table pricing.price(id text primary key,book_id text not null,sku_id text not null,amount_minor bigint not null,compare_minor bigint,
    effective_at timestamptz not null,expires_at timestamptz,unique(book_id,sku_id,effective_at));
  create table inventory.stockitem(id text primary key,scope_id text not null,sku_id text not null,location_id text not null,onhand bigint not null,
    safety bigint not null,version bigint not null,status text not null,updated_at timestamptz not null);
  create table inventory.reservation(id text primary key,mall_id text not null,stockitem_id text not null,quantity bigint not null,state text not null,
    expires_at timestamptz not null);
  create table inventory.snapshot(stockitem_id text not null,observed_at timestamptz not null,source text not null,onhand bigint not null,
    source_version text not null,primary key(stockitem_id,observed_at,source));
  create table inventory.movement(id text primary key,mall_id text not null,stockitem_id text not null,kind text not null,quantity_delta bigint not null,
    reference_type text not null,reference_id text not null,occurred_at timestamptz not null);
  create table ordering.orderrecord(id text primary key,mall_id text not null,payment_state text not null,fulfillment_state text not null,
    aftersale_state text not null,created_at timestamptz not null,updated_at timestamptz not null);
  create table ordering.line(id text primary key,order_id text not null,sku_id text not null,product_id text,title_snapshot text not null,
    quantity bigint not null,total_minor bigint not null,provider text,supplier_id text);
  create table ordering.aftersale(id text primary key,order_id text not null,line_id text,state text not null,amount_minor bigint);
  create table finance.settlement(id text primary key,scope_id text not null,partner_id text not null,amount_minor bigint not null,state text not null,
    paid_at timestamptz,approved_at timestamptz,frozen_at timestamptz);
  create function reporting.cockpit(text) returns jsonb language sql stable as 'select ''{}''::jsonb';
  create table runtime.schemaversion(version text primary key,checksum text not null);
  insert into organization.organization values('mall:d1708f04df2dd8a61736852c4900fb43','mall','主打团商城');
  insert into catalog.category values('category:food',null,'food','食品','active',1),('category:ordinary',null,'ordinary','普通商品','active',2);
  insert into catalog.poolbinding values('mall:d1708f04df2dd8a61736852c4900fb43','pool:default','active',clock_timestamp());
  insert into catalog.product values
    ('product:ordinary',null,null,'category:ordinary','普通商品','physical','{}','active',0,clock_timestamp(),clock_timestamp()),
    ('product:cake',null,null,'category:food','蛋糕','physical','{"provider":"cake","settlementMode":"订单结算"}','active',0,clock_timestamp(),clock_timestamp());
  insert into catalog.sku values('sku:ordinary','product:ordinary','ORDINARY-1','{}','active',0),('sku:cake','product:cake','CAKE-1','{}','active',0);
  insert into catalog.listing values
    ('listing:ordinary','mall:d1708f04df2dd8a61736852c4900fb43','pool:default','sku:ordinary','普通商品','published',clock_timestamp(),null,0,clock_timestamp(),clock_timestamp()),
    ('listing:cake','mall:d1708f04df2dd8a61736852c4900fb43','pool:default','sku:cake','蛋糕','published',clock_timestamp(),null,0,clock_timestamp(),clock_timestamp());
  insert into pricing.pricebook values('pricebook:default','mall:d1708f04df2dd8a61736852c4900fb43','CNY','默认价格','active',0);
  insert into pricing.price values('price:ordinary','pricebook:default','sku:ordinary',990,1290,clock_timestamp(),null),
    ('price:cake','pricebook:default','sku:cake',19900,25900,clock_timestamp(),null);
  insert into inventory.stockitem values('stock:ordinary','mall:d1708f04df2dd8a61736852c4900fb43','sku:ordinary','location:default',100,5,0,'active',clock_timestamp()),
    ('stock:cake','mall:d1708f04df2dd8a61736852c4900fb43','sku:cake','location:default',10,1,0,'active',clock_timestamp());
`;
