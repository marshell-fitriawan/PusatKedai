-- =====================================================================
-- Uji penyesuaian stok manual (M4-1, M4-2b)
--
-- Transaksional + ROLLBACK. Pakai: npm run db -- supabase/tests/stok.sql
-- Kolom "lulus" harus true semua.
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no int, uji text, harapan text, hasil text, lulus boolean
) on commit drop;

do $$
declare
  v_kedai  uuid := '11111111-1111-4111-8111-000000000001';
  v_prod   uuid := '33333333-3333-4333-8333-000000000001';
  v_admin  uuid;
  v_baru   uuid;
  v_n      integer;
  v_txt    text;
  r        record;
begin
  select id into v_admin from admin_users limit 1;

  -- Produk baru yang belum punya baris stok di kedai mana pun.
  insert into products (name, price, category)
  values ('Produk Uji Stok', 12000, 'uji')
  returning id into v_baru;

  -- === 1. Stok pertama kali -> reason `initial` ==================
  select * into r from adjust_stock(v_kedai, v_baru, 25, 'Stok awal gudang', v_admin);
  insert into hasil values (1, 'Pengisian pertama: quantity', '25', r.quantity::text, r.quantity = 25);
  insert into hasil values (2, 'Pengisian pertama: reason', 'initial', r.reason, r.reason = 'initial');
  insert into hasil values (3, 'Delta dari nol', '25', r.delta::text, r.delta = 25);

  -- === 4. Perubahan berikutnya -> reason `adjustment` ============
  select * into r from adjust_stock(v_kedai, v_baru, 18, 'Stok opname: kurang 7', v_admin);
  insert into hasil values (4, 'Perubahan: reason', 'adjustment', r.reason, r.reason = 'adjustment');
  insert into hasil values (5, 'Perubahan: delta negatif', '-7', r.delta::text, r.delta = -7);

  -- === 6. balance_after di ledger cocok dengan saldo =============
  select balance_after into v_n from stock_movements
   where kedai_id = v_kedai and product_id = v_baru
   order by created_at desc limit 1;
  insert into hasil values (6, 'balance_after cocok', '18', v_n::text, v_n = 18);

  -- === 7. Alasan tersimpan =======================================
  select note into v_txt from stock_movements
   where kedai_id = v_kedai and product_id = v_baru
   order by created_at desc limit 1;
  insert into hasil values (7, 'Alasan tersimpan di ledger', 'Stok opname: kurang 7',
                            coalesce(v_txt, 'NULL'), v_txt = 'Stok opname: kurang 7');

  -- === 8. Pencatat tercatat sebagai admin ========================
  select count(*) into v_n from stock_movements
   where kedai_id = v_kedai and product_id = v_baru
     and created_by_admin_id = v_admin;
  insert into hasil values (8, 'Pencatat = admin', '2', v_n::text, v_n = 2);

  -- === 9. Alasan kosong ditolak ==================================
  -- Angka stok yang berubah tanpa alasan tertulis sama saja tidak ada catatan.
  begin
    perform adjust_stock(v_kedai, v_baru, 30, '   ', v_admin);
    insert into hasil values (9, 'Alasan kosong', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (9, 'Alasan kosong', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 10. Delta nol: tidak menulis movement =====================
  select count(*) into v_n from stock_movements
   where kedai_id = v_kedai and product_id = v_baru;

  select * into r from adjust_stock(v_kedai, v_baru, 18, 'Tidak berubah', v_admin);
  insert into hasil values (10, 'Delta nol: reason', 'tidak berubah', r.reason,
                            r.reason = 'tidak berubah');

  select count(*) into v_n from stock_movements
   where kedai_id = v_kedai and product_id = v_baru;
  insert into hasil values (11, 'Delta nol: tidak ada movement baru', '2', v_n::text, v_n = 2);

  -- === 12. Stok negatif DIIZINKAN ================================
  -- Admin harus bisa mencatat kondisi sebenarnya, termasuk yang minus.
  select * into r from adjust_stock(v_kedai, v_baru, -5, 'Koreksi: barang hilang', v_admin);
  insert into hasil values (12, 'Stok negatif diizinkan', '-5', r.quantity::text, r.quantity = -5);

  -- === 13. Stok kedai lain tidak ikut berubah ====================
  select count(*) into v_n from kedai_stock
   where product_id = v_baru and kedai_id <> v_kedai;
  insert into hasil values (13, 'Kedai lain tidak tersentuh', '0', v_n::text, v_n = 0);
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;
