-- =====================================================================
-- Uji kas keluar dari laci kas (M8-3): expenses.shift_id + from_cash.
--
-- Invariant: "diambil dari kas" wajib mengikat ke sebuah sesi
-- (expenses_from_cash_requires_shift, 0016). reconcile_shift mengurangi
-- pengeluaran dari_cash milik sesi itu dari expected_cash; pengeluaran
-- biasa tidak.
--
-- Pakai: npm run db -- supabase/tests/kas-keluar.sql
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no int, uji text, harapan text, hasil text, lulus boolean
) on commit drop;

do $$
declare
  v_kedai  uuid := '11111111-1111-4111-8111-000000000001';
  v_emp    uuid := '22222222-2222-4222-8222-000000000001';
  v_shift  uuid;
  v_tx     uuid := gen_random_uuid();
  v_items  jsonb;
  v_expected numeric;
begin
  insert into shifts (kedai_id, business_date, opened_by, opening_cash)
  values (v_kedai, current_date, v_emp, 100000) returning id into v_shift;

  v_items := jsonb_build_array(
    jsonb_build_object('product_id', '33333333-3333-4333-8333-000000000001',
                       'name', 'Kopi Susu Gula Aren', 'price', 22000, 'qty', 2)
  );
  perform create_transaction(v_tx, v_kedai, v_shift, v_emp, 'OFF-KK-1',
                             'dev', 'tunai', now(), v_items);

  -- 1. Pengeluaran "dari kas" + terikat sesi -> dikurangi.
  insert into expenses (kedai_id, category, description, amount, expense_date,
                        recorded_by_employee_id, shift_id, from_cash)
  values (v_kedai, 'bahan_baku', 'beli sirup di laci', 15000, current_date,
          v_emp, v_shift, true);

  select expected_cash into v_expected from public.reconcile_shift(v_shift, 0);
  insert into hasil values (1, 'Dari kas dikurangi expected_cash',
    '129000', v_expected::text, v_expected = 129000);

  -- 2. Dari kas TANPA sesi ditolak (constraint 0016).
  begin
    insert into expenses (kedai_id, category, description, amount, expense_date,
                          recorded_by_employee_id, shift_id, from_cash)
    values (v_kedai, 'bahan_baku', 'coba tanpa sesi', 5000, current_date,
            v_emp, null, true);
    insert into hasil values (2, 'from_cash tanpa shift_id', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (2, 'from_cash tanpa shift_id', 'ditolak',
      'ditolak (' || sqlstate || ')', sqlstate in ('23514', '23502'));
  end;

  -- 3. Pengeluaran biasa (tidak dari kas) tidak mengurangi expected_cash.
  insert into expenses (kedai_id, category, description, amount, expense_date,
                        recorded_by_employee_id, shift_id, from_cash)
  values (v_kedai, 'bahan_baku', 'beli stok (bukan dari kas)', 5000, current_date,
          v_emp, v_shift, false);

  select expected_cash into v_expected from public.reconcile_shift(v_shift, 0);
  insert into hasil values (3, 'Pengeluaran biasa tidak mengurangi',
    '129000', v_expected::text, v_expected = 129000);

  -- 4. Tutup sesi: cash_difference ikut memperhitungkan kas keluar.
  --    closing 120000, expected 129000 (100000 + 44000 - 15000).
  update shifts
     set closing_cash = 120000, closed_at = now(), closed_by = v_emp,
         status = 'closed'
   where id = v_shift;

  select cash_difference into v_expected from public.reconcile_shift(v_shift, 0);
  insert into hasil values (4, 'Selisih saat tutup memuat kas keluar',
    '-9000', v_expected::text, v_expected = -9000);
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;