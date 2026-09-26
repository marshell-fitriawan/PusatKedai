-- Verifikasi skema: memastikan semua constraint, index, dan trigger yang
-- ditulis di 0001_init.sql benar-benar ada di database.
--
-- Berguna terutama kalau migration pernah diterapkan manual lewat SQL Editor
-- -- kolom bisa saja ada semua sementara constraint-nya tertinggal, dan itu
-- justru bagian yang menjaga integritas data.
--
-- Pakai: npm run db -- supabase/tests/schema-check.sql
-- Semua baris harus berstatus "ada".

with expected(kind, name) as (
  values
    -- CHECK & constraint bernama
    ('constraint', 'shifts_closed_complete'),
    ('constraint', 'mutations_different_kedai'),
    ('constraint', 'mutations_one_requester'),
    ('constraint', 'mutations_approved_complete'),
    ('constraint', 'mutations_rejected_needs_note'),
    ('constraint', 'transactions_void_complete'),
    ('constraint', 'movements_sale_needs_transaction'),
    ('constraint', 'movements_mutation_needs_mutation'),
    ('constraint', 'movements_adjustment_needs_note'),
    ('constraint', 'movements_one_actor'),
    ('constraint', 'expenses_one_recorder'),
    ('constraint', 'movements_produksi_needs_produksi'),
    ('constraint', 'bahan_movement_produksi_needs_produksi'),
    ('constraint', 'bahan_movement_koreksi_needs_note'),
    ('constraint', 'movements_waste_needs_waste'),
    ('constraint', 'void_request_decision_complete'),
    ('constraint', 'void_request_rejected_needs_note'),
    ('constraint', 'expenses_from_cash_requires_shift'),

    -- Index penegak aturan (bukan sekadar performa)
    ('index', 'shifts_one_open_per_kedai'),
    ('index', 'transactions_number_per_day'),
    ('index', 'transactions_local_number_per_device'),
    ('index', 'movements_once_per_transaction'),
    ('index', 'movements_once_per_mutation'),
    ('index', 'movements_once_per_produksi'),
    ('index', 'movements_once_per_waste'),
    ('index', 'bahan_movement_once_per_produksi'),

    -- Index performa
    ('index', 'employees_kedai_idx'),
    ('index', 'products_active_idx'),
    ('index', 'shifts_kedai_date_idx'),
    ('index', 'mutations_pending_idx'),
    ('index', 'mutations_from_idx'),
    ('index', 'mutations_to_idx'),
    ('index', 'transactions_kedai_date_idx'),
    ('index', 'transactions_shift_idx'),
    ('index', 'transaction_items_tx_idx'),
    ('index', 'movements_kedai_product_idx'),
    ('index', 'expenses_kedai_date_idx'),
    ('index', 'kedai_warehouse_idx'),
    ('index', 'produksi_bahan_produksi_idx'),
    ('index', 'bahan_movement_bahan_idx'),
    ('index', 'waste_kedai_at_idx'),
    ('index', 'waste_shift_idx'),
    ('index', 'sisa_fisik_shift_idx'),
    ('index', 'notifikasi_unread_idx'),
    ('index', 'notifikasi_kedai_idx'),
    ('index', 'void_request_one_pending'),
    ('index', 'void_request_pending_idx'),
    ('index', 'void_request_kedai_idx'),
    ('index', 'expenses_shift_idx'),

    ('trigger', 'kedai_stock_set_updated_at'),
    ('trigger', 'bahan_stock_set_updated_at')
),
actual as (
  select 'constraint' as kind, c.conname as name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
  union all
  select 'index', indexname from pg_indexes where schemaname = 'public'
  union all
  select 'trigger', tgname from pg_trigger where not tgisinternal
)
select
  e.kind,
  e.name,
  case when a.name is null then 'HILANG' else 'ada' end as status
from expected e
left join actual a on a.kind = e.kind and a.name = e.name
where a.name is null
order by e.kind, e.name;
