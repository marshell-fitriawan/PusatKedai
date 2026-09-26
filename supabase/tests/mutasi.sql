-- =====================================================================
-- Uji eksekusi mutasi stok antar kedai (M4-4, M4-5)
--
-- Membuktikan approve_mutation() benar-benar atomik dan idempoten:
--   1. Menyetujui mutasi 'pending' memindahkan stok + menulis dua baris
--      ledger (mutation_out/mutation_in) sekaligus.
--   2. Dipanggil ulang (retry karena koneksi putus) TIDAK memindahkan stok
--      dua kali.
--   3. Mutasi yang bukan 'pending' (sudah rejected) ditolak.
--   4. Stok kedai asal yang tidak mencukupi menolak eksekusi.
--   5. Kedai tujuan yang belum punya baris stok diisi lewat upsert.
--
-- Seluruh isi file berjalan dalam satu transaction dan DI-ROLLBACK.
-- Pakai: npm run db -- supabase/tests/mutasi.sql
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no      int,
  uji     text,
  harapan text,
  hasil   text,
  lulus   boolean
) on commit drop;

do $$
declare
  v_kedai1 uuid := '11111111-1111-4111-8111-000000000001';
  v_kedai2 uuid := '11111111-1111-4111-8111-000000000002';
  v_emp1   uuid := '22222222-2222-4222-8222-000000000001';
  v_prod   uuid := '33333333-3333-4333-8333-000000000001';
  v_admin  uuid;
  v_mut    uuid := gen_random_uuid();
  v_mut2   uuid := gen_random_uuid();
  v_mut3   uuid := gen_random_uuid();
  v_reject uuid := gen_random_uuid();
  v_kedai3 uuid := gen_random_uuid();
  v_status text;
  v_from_q integer;
  v_to_q   integer;
  v_asal_awal   integer := 0;
  v_tujuan_awal integer := 0;
  v_beda   boolean;
begin
  select id into v_admin from admin_users limit 1;

  -- fiktif: kedai3 tanpa baris stok sama sekali (untuk uji upsert).
  insert into kedai (id, name, timezone) values (v_kedai3, 'Kedai Uji Baru', 'Asia/Kuala_Lumpur');

  -- ================================================================
  -- Fixture: mutasi pending milik karyawan kedai1 -> kedai2.
  -- ================================================================
  insert into stock_mutations
    (id, from_kedai_id, to_kedai_id, product_id, quantity,
     requested_by_employee_id, note)
  values
    (v_mut, v_kedai1, v_kedai2, v_prod, 5, v_emp1, 'Stok dititipkan');

  insert into stock_mutations
    (id, from_kedai_id, to_kedai_id, product_id, quantity,
     requested_by_employee_id, note)
  values
    (v_mut2, v_kedai1, v_kedai3, v_prod, 3, v_emp1, 'Upsert ke kedai baru');

  insert into stock_mutations
    (id, from_kedai_id, to_kedai_id, product_id, quantity,
     requested_by_employee_id, note)
  values
    (v_mut3, v_kedai1, v_kedai2, v_prod, 99999, v_emp1, 'Melebihi stok');

  -- Sudah ditolak (bukan pending) -- harus tetap ditolak saat approve.
  insert into stock_mutations
    (id, from_kedai_id, to_kedai_id, product_id, quantity,
     requested_by_employee_id, status, note)
  values
    (v_reject, v_kedai1, v_kedai2, v_prod, 2, v_emp1, 'rejected', 'Stok habis');

  -- === 1. Approve pending: stok pindah + dua baris ledger =========
  begin
    select coalesce(quantity, 0) into v_asal_awal
    from kedai_stock where kedai_id = v_kedai1 and product_id = v_prod;
    select coalesce(quantity, 0) into v_tujuan_awal
    from kedai_stock where kedai_id = v_kedai2 and product_id = v_prod;

    select status, from_quantity, to_quantity into v_status, v_from_q, v_to_q
    from public.approve_mutation(v_mut, v_admin);

    v_beda := (v_status = 'approved')
      and (v_from_q = v_asal_awal - 5)        -- saldo asal turun tepat 5
      and (v_to_q = v_tujuan_awal + 5)        -- saldo tujuan naik tepat 5
      and exists (
        select 1 from stock_movements
        where ref_mutation_id = v_mut and reason = 'mutation_out' and delta = -5
      )
      and exists (
        select 1 from stock_movements
        where ref_mutation_id = v_mut and reason = 'mutation_in' and delta = 5
      )
      and exists (
        select 1 from stock_mutations
        where id = v_mut and status = 'approved' and executed_at is not null
          and approved_by = v_admin
      );

    if v_beda then
      insert into hasil values (1, 'Approve memindahkan stok + ledger', 'terpenuhi', 'terpenuhi', true);
    else
      insert into hasil values (1, 'Approve memindahkan stok + ledger', 'terpenuhi', 'TIDAK', false);
    end if;
  exception when others then
    insert into hasil values (1, 'Approve memindahkan stok + ledger', 'terpenuhi', 'error: ' || sqlerrm, false);
  end;

  -- === 2. Approve ulang (retry): tidak memindahkan dua kali =======
  begin
    select status into v_status
    from public.approve_mutation(v_mut, v_admin);

    -- Jumlah baris ledger untuk mutasi ini harus tetap 2 (index unik menahan
    -- baris ketiga). Kalau function idempoten-nya berfungsi, pemanggilan
    -- kedua berhenti lebih awal.
    select count(*) = 2 into v_beda
    from stock_movements
    where ref_mutation_id = v_mut;

    if v_status = 'approved' and v_beda then
      insert into hasil values (2, 'Approve ulang idempoten', 'tetap 2 ledger', 'tetap 2', true);
    else
      insert into hasil values (2, 'Approve ulang idempoten', 'tetap 2 ledger', 'gagal', false);
    end if;
  exception when others then
    insert into hasil values (2, 'Approve ulang idempoten', 'tetap 2 ledger', 'error: ' || sqlerrm, false);
  end;

  -- === 3. Mutasi rejected ditolak approve =========================
  begin
    select status into v_status
    from public.approve_mutation(v_reject, v_admin);
    insert into hasil values (3, 'Approve mutasi rejected', 'ditolak', 'DITERIMA: ' || v_status, false);
  exception when others then
    insert into hasil values (3, 'Approve mutasi rejected', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 4. Stok asal tidak mencukupi ditolak =======================
  begin
    select status into v_status
    from public.approve_mutation(v_mut3, v_admin);
    insert into hasil values (4, 'Approve melebihi stok asal', 'ditolak', 'DITERIMA: ' || v_status, false);
  exception when others then
    insert into hasil values (4, 'Approve melebihi stok asal', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 5. Mutasi tidak ditemukan ditolak ==========================
  begin
    select status into v_status
    from public.approve_mutation(gen_random_uuid(), v_admin);
    insert into hasil values (5, 'Approve mutasi tak dikenal', 'ditolak', 'DITERIMA: ' || v_status, false);
  exception when others then
    insert into hasil values (5, 'Approve mutasi tak dikenal', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 6. Kedai tujuan belum punya stok diisi upsert ==============
  begin
    select status, from_quantity, to_quantity into v_status, v_from_q, v_to_q
    from public.approve_mutation(v_mut2, v_admin);

    v_beda := v_status = 'approved'
      and v_to_q = 3
      and exists (
        select 1 from kedai_stock
        where kedai_id = v_kedai3 and product_id = v_prod and quantity = 3
      );

    if v_beda then
      insert into hasil values (6, 'Tujuan tanpa stok diisi upsert', 'terisi 3', 'terisi', true);
    else
      insert into hasil values (6, 'Tujuan tanpa stok diisi upsert', 'terisi 3', 'TIDAK', false);
    end if;
  exception when others then
    insert into hasil values (6, 'Tujuan tanpa stok diisi upsert', 'terisi 3', 'error: ' || sqlerrm, false);
  end;

  -- === 7. Ledger asal & tujuan saling menyeimbangkan ==============
  begin
    -- jumlah delta seluruh movement mutasi ini (kedua kedai) harus nol.
    select coalesce(sum(delta), 0) = 0 into v_beda
    from stock_movements
    where ref_mutation_id = v_mut;

    if v_beda then
      insert into hasil values (7, 'Delta saling menyeimbangkan', 'jumlah nol', 'nol', true);
    else
      insert into hasil values (7, 'Delta saling menyeimbangkan', 'jumlah nol', 'TIDAK', false);
    end if;
  end;
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;