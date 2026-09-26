-- =====================================================================
-- Uji void harus review (M8-1): request_void / decide_void
--
-- Invariant baru (keputusan desain 12): kasir hanya MENGAJUKAN void
-- (status -> perlu_review, stok TIDAK kembali). Pemilik setujui -> void +
-- stok balik; tolak -> kembali completed. Fungsi lama void_transaction
-- tetap diuji terpisah di void.sql.
--
-- Transaksional + ROLLBACK, aman dijalankan kapan saja.
-- Pakai: npm run db -- supabase/tests/void-review.sql
-- Kolom "lulus" harus true semua.
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no int, uji text, harapan text, hasil text, lulus boolean
) on commit drop;

do $$
declare
  v_kedai   uuid := '11111111-1111-4111-8111-000000000001';  -- Melati
  v_kedai2  uuid := '11111111-1111-4111-8111-000000000002';  -- Kenanga
  v_emp     uuid := '22222222-2222-4222-8222-000000000001';
  v_emp2    uuid := '22222222-2222-4222-8222-000000000003';
  v_admin   uuid;
  v_prod    uuid := '33333333-3333-4333-8333-000000000001';
  v_shift   uuid;
  v_shift2  uuid;
  v_tx1     uuid := gen_random_uuid();
  v_tx2     uuid := gen_random_uuid();
  v_tx3     uuid := gen_random_uuid();
  v_items   jsonb;
  v_stok0   integer;
  v_stok1   integer;
  v_status  text;
  v_n       integer;
  v_req     uuid;
  v_expected numeric;
begin
  select id into v_admin from admin_users limit 1;

  insert into shifts (kedai_id, business_date, opened_by, opening_cash)
  values (v_kedai, current_date, v_emp, 100000) returning id into v_shift;

  insert into shifts (kedai_id, business_date, opened_by, opening_cash)
  values (v_kedai2, current_date, v_emp2, 0) returning id into v_shift2;

  v_items := jsonb_build_array(
    jsonb_build_object('product_id', v_prod, 'name', 'Kopi Susu Gula Aren', 'price', 22000, 'qty', 3)
  );

  select quantity into v_stok0
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;

  perform create_transaction(v_tx1, v_kedai, v_shift, v_emp, 'OFF-VR-1',
                             'dev', 'tunai', now(), v_items);

  select quantity into v_stok1
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;
  insert into hasil values (1, 'Jual 3: stok turun (penyiapan)',
    (v_stok0 - 3)::text, v_stok1::text, v_stok1 = v_stok0 - 3);

  -- === 2. request_void: perlu_review, stok TIDAK kembali ==========
  perform request_void(v_tx1, v_kedai, v_emp, 'salah kasih pesanan ke pelanggan');

  select status into v_status from transactions where id = v_tx1;
  insert into hasil values (2, 'Status jadi perlu_review', 'perlu_review',
    v_status, v_status = 'perlu_review');

  select quantity into v_n
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;
  insert into hasil values (3, 'Stok TIDAK dikembalikan saat pengajuan',
    v_stok1::text, v_n::text, v_n = v_stok1);

  select count(*) into v_n from void_request
   where transaction_id = v_tx1 and status = 'pending'
     and char_length(btrim(alasan)) >= 3;
  insert into hasil values (4, 'void_request pending + alasan', '1', v_n::text, v_n = 1);

  -- === 5. Pengajuan ganda = idempoten =============================
  perform request_void(v_tx1, v_kedai, v_emp, 'salah kasih pesanan ke pelanggan');
  select count(*) into v_n from void_request
   where transaction_id = v_tx1 and status = 'pending';
  insert into hasil values (5, 'Pengajuan ganda tidak dobel', '1', v_n::text, v_n = 1);

  -- === 6. Alasan wajib (>= 3 karakter) ============================
  perform create_transaction(v_tx2, v_kedai, v_shift, v_emp, 'OFF-VR-2',
                             'dev', 'tunai', now(), v_items);
  begin
    perform request_void(v_tx2, v_kedai, v_emp, 'x');
    insert into hasil values (6, 'request_void alasan pendek', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (6, 'request_void alasan pendek', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 7. Kedai lain tidak bisa mengajukan ========================
  begin
    perform request_void(v_tx1, v_kedai2, v_emp, 'coba kedai lain');
    insert into hasil values (7, 'Pengajuan oleh kedai lain', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (7, 'Pengajuan oleh kedai lain', 'ditolak', 'ditolak', true);
  end;

  -- === 8. Shift yang sudah ditutup tak bisa diajukan ==============
  perform create_transaction(v_tx3, v_kedai2, v_shift2, v_emp2, 'OFF-VR-3',
                             'dev', 'tunai', now(), v_items);
  update shifts set status = 'closed', closed_at = now(), closed_by = v_emp2
   where id = v_shift2;
  begin
    perform request_void(v_tx3, v_kedai2, v_emp2, 'coba shift tertutup');
    insert into hasil values (8, 'Pengajuan dari shift tertutup', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (8, 'Pengajuan dari shift tertutup', 'ditolak', 'ditolak', true);
  end;

  -- === 9. Setujui: void + stok balik + jejak ======================
  select id into v_req from void_request where transaction_id = v_tx1 and status = 'pending';

  perform decide_void(v_req, true, v_admin, 'setuju, salah kasih');

  select status into v_status from transactions where id = v_tx1;
  insert into hasil values (9, 'Approved: status void', 'void', v_status, v_status = 'void');

  select quantity into v_n
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;
  -- v_tx2 sudah terjual (uji 6) sehingga stok kena -3 lagi. Yang benar
  -- diverifikasi: void mengembalikan persis 3 milik v_tx1.
  insert into hasil values (10, 'Approved: stok balik milik v_tx1',
    (v_stok0 - 3)::text, v_n::text, v_n = v_stok0 - 3);

  select count(*) into v_n from stock_movements
   where ref_transaction_id = v_tx1 and reason = 'void' and delta = 3
     and created_by_admin_id = v_admin;
  insert into hasil values (11, 'Ledger void (+3) oleh admin',
    '1', v_n::text, v_n = 1);

  select count(*) into v_n from void_request
   where id = v_req and status = 'approved' and decided_by = v_admin
     and decided_at is not null;
  insert into hasil values (12, 'void_request approved + jejak',
    '1', v_n::text, v_n = 1);

  -- === 13. Keputusan ganda ditolak ================================
  begin
    perform decide_void(v_req, true, v_admin, 'dua kali');
    insert into hasil values (13, 'decide_void dua kali', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (13, 'decide_void dua kali', 'ditolak', 'ditolak', true);
  end;

  -- === 14. Tolak tanpa alasan ditolak =============================
  perform request_void(v_tx2, v_kedai, v_emp, 'pelanggan protes rasanya');
  select id into v_req from void_request where transaction_id = v_tx2 and status = 'pending';
  begin
    perform decide_void(v_req, false, v_admin, null);
    insert into hasil values (14, 'Tolak tanpa alasan', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (14, 'Tolak tanpa alasan', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 15-16. Kasır bisa mengajukan ulang, lalu ditolak ===========
  perform request_void(v_tx2, v_kedai, v_emp, 'pelanggan protes rasanya');
  select id into v_req from void_request where transaction_id = v_tx2 and status = 'pending';

  perform decide_void(v_req, false, v_admin, 'foto tidak meyakinkan');

  select status into v_status from transactions where id = v_tx2;
  insert into hasil values (15, 'Rejected: kembali completed',
    'completed', v_status, v_status = 'completed');

  select count(*) into v_n from void_request
   where transaction_id = v_tx2 and status = 'rejected' and decided_by = v_admin
     and char_length(btrim(coalesce(note, ''))) >= 1;
  insert into hasil values (16, 'Tolak: rejected + alasan tersimpan',
    '1', v_n::text, v_n = 1);

  -- === 17. Status perlu_review tidak dihitung expected_cash ========
  -- v_shift: opening 100000. v_tx1 sudah void (uji 9). v_tx2 masih
  -- completed setelah ditolak (uji 15). Ajukan void v_tx2 lagi -- kini
  -- perlu_review -- lalu rekonsiliasi: keduanya tidak terhitung tunai.
  perform request_void(v_tx2, v_kedai, v_emp, 'harusnya tidak benar');
  select expected_cash into v_expected from public.reconcile_shift(v_shift, 0);
  insert into hasil values (17, 'expected_cash mengabaikan perlu_review',
    '100000', v_expected::text, v_expected = 100000);

  -- === 18. Setelah tolak -> completed -> masuk expected lagi ======
  select id into v_req from void_request where transaction_id = v_tx2 and status = 'pending';
  perform decide_void(v_req, false, v_admin, 'tidak ada bukti pelanggan');
  select expected_cash into v_expected from public.reconcile_shift(v_shift, 0);
  insert into hasil values (18, 'Setelah tolak, tx dihitung lagi',
    '166000', v_expected::text, v_expected = 166000);
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;