\set ON_ERROR_STOP on

begin;

delete from reporting.fact where dimensions->>'simulation'='supplier-business-v1';
delete from finance.settlement where id like 'simulation:supplier-business:v1:settlement:%';
delete from finance.reconciliation where id like 'simulation:supplier-business:v1:reconciliation:%';
delete from channel.statement where id like 'simulation:supplier-business:v1:statement:%';
delete from channel.connection where id='simulation:supplier-business:v1:connection';
delete from ordering.aftersale where id like 'simulation:supplier-business:v1:aftersale:%';
delete from ordering.line where order_id like 'simulation:supplier-business:v1:order:%';
delete from ordering.orderrecord where id like 'simulation:supplier-business:v1:order:%';

commit;

select count(*) remaining_simulation_orders
from ordering.orderrecord where id like 'simulation:supplier-business:v1:order:%';
