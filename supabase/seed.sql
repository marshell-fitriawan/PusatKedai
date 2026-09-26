-- =====================================================================
-- Seed data pengembangan
--
-- !! MENGHAPUS SELURUH DATA OPERASIONAL !!
-- Hanya untuk database development. Jangan pernah dijalankan di instance
-- klien. Script pemanggilnya (scripts/seed.mjs) menolak berjalan kalau
-- tabel transactions sudah berisi data, kecuali dipaksa dengan --force.
--
-- Baris admin_users mengambil id dari auth.users berdasarkan email, jadi
-- user Supabase Auth harus dibuat lebih dulu (dilakukan scripts/seed.mjs).
--
-- Pakai: npm run seed
-- =====================================================================

truncate
  expenses,
  qris_payments,
  transaction_items,
  transactions,
  stock_movements,
  stock_mutations,
  kedai_stock,
  produksi_bahan,
  produksi,
  bahan_movement,
  bahan_stock,
  bahan_mentah,
  shifts,
  employees,
  products,
  admin_users,
  kedai
restart identity cascade;

-- --------------------------------------------------------------- kedai
insert into kedai (id, name, address, phone, timezone, low_stock_threshold) values
  ('11111111-1111-4111-8111-000000000001', 'Kedai Melati',  'Jl. Melati No. 12, Bandung',  '022-1110001', 'Asia/Kuala_Lumpur', 10),
  ('11111111-1111-4111-8111-000000000002', 'Kedai Kenanga', 'Jl. Kenanga No. 5, Bandung',  '022-1110002', 'Asia/Kuala_Lumpur', 5),
  ('00000000-0000-4000-8000-000000000001', 'Gudang Pusat',  'Gudang pusat (tidak menjual)', NULL,          'Asia/Kuala_Lumpur', 5);

-- Gudang pusat: tempat stok jadi berkumpul dari produksi dan sumber assign.
update kedai set is_warehouse = true where id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------- admin_users
-- id harus sama dengan user di Supabase Auth. Dua akun -- satu per role --
-- supaya login /admin bisa diuji di kedua hak akses.
insert into admin_users (id, name, email, role)
select u.id, 'Owner Dev', u.email, 'owner'
from auth.users u
where u.email = 'owner@kedaidev.test';

insert into admin_users (id, name, email, role)
select u.id, 'Admin Pusat Dev', u.email, 'admin_pusat'
from auth.users u
where u.email = 'admin@kedaidev.test';

-- ----------------------------------------------------------- employees
-- qr_token dev sengaja dibuat terbaca supaya gampang diuji manual.
-- Di produksi token digenerate kriptografis (task M3-1).
insert into employees (id, kedai_id, name, role, qr_token) values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Rina Kasir',   'kasir',       'DEV-QR-RINA-0001'),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 'Budi Kepala',  'admin_kedai', 'DEV-QR-BUDI-0002'),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000002', 'Sari Kasir',   'kasir',       'DEV-QR-SARI-0003');

-- ------------------------------------------------------------ products
-- Katalog dipakai bersama seluruh kedai; hanya stoknya yang per kedai.
insert into products (id, name, price, category) values
  ('33333333-3333-4333-8333-000000000001', 'Kopi Susu Gula Aren', 22000, 'kopi'),
  ('33333333-3333-4333-8333-000000000002', 'Americano',           18000, 'kopi'),
  ('33333333-3333-4333-8333-000000000003', 'Cappuccino',          25000, 'kopi'),
  ('33333333-3333-4333-8333-000000000004', 'Latte',               25000, 'kopi'),
  ('33333333-3333-4333-8333-000000000005', 'Matcha Latte',        27000, 'non-kopi'),
  ('33333333-3333-4333-8333-000000000006', 'Cokelat Panas',       23000, 'non-kopi'),
  ('33333333-3333-4333-8333-000000000007', 'Teh Lemon',           15000, 'non-kopi'),
  ('33333333-3333-4333-8333-000000000008', 'Roti Bakar Cokelat',  18000, 'makanan'),
  ('33333333-3333-4333-8333-000000000009', 'Kentang Goreng',      20000, 'makanan'),
  ('33333333-3333-4333-8333-000000000010', 'Pisang Goreng',       16000, 'makanan');

-- ---------------------------------------------------- stok awal + ledger
-- Stok awal WAJIB lewat stock_movements, bukan UPDATE langsung ke
-- kedai_stock. Kalau seed saja sudah melanggar aturan itu, ledger-nya
-- bolong sejak baris pertama dan audit trail kehilangan titik awal.
with target as (
  select
    k.id as kedai_id,
    p.id as product_id,
    -- Kedai Melati stoknya lebih banyak; satu produk sengaja dibuat tipis
    -- supaya indikator "stok menipis" bisa langsung diuji di UI.
    case
      when p.name = 'Pisang Goreng' then 3
      when k.name = 'Kedai Melati'  then 40
      else 25
    end as qty
  -- Gudang pusat tidak menerima stok awal silang-kedai; stoknya diisi oleh
-- produksi di bawah.
  from kedai k
  cross join products p
  where k.is_warehouse = false
),
inserted as (
  insert into kedai_stock (kedai_id, product_id, quantity)
  select kedai_id, product_id, qty from target
  returning kedai_id, product_id, quantity
)
insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, note)
select kedai_id, product_id, quantity, quantity, 'initial', 'Stok awal seed dev'
from inserted;

-- ------------------------------------------------------------ expenses
-- Beberapa contoh supaya laporan untung-rugi punya pembanding.
insert into expenses (kedai_id, category, description, amount, expense_date, recorded_by_employee_id) values
  ('11111111-1111-4111-8111-000000000001', 'bahan_baku', 'Biji kopi 5kg',    750000, current_date - 2, '22222222-2222-4222-8222-000000000002'),
  ('11111111-1111-4111-8111-000000000001', 'listrik',    'Token listrik',    200000, current_date - 1, '22222222-2222-4222-8222-000000000002'),
  ('11111111-1111-4111-8111-000000000002', 'bahan_baku', 'Susu UHT 24 pak',  480000, current_date - 1, '22222222-2222-4222-8222-000000000003');

-- ------------------------------------------------------- bahan mentah
-- Katalog bahan + stok awal mengikuti aturan yang sama seperti produk jadi:
-- saldo dan ledger ditulis bersama (bahan_movement reason 'masuk').
insert into bahan_mentah (id, name, satuan) values
  ('44444444-4444-4444-8444-000000000001', 'Gula Pasir',    'kg'),
  ('44444444-4444-4444-8444-000000000002', 'Biji Kopi',     'gram'),
  ('44444444-4444-4444-8444-000000000003', 'Bubuk Coklat',  'gram'),
  ('44444444-4444-4444-8444-000000000004', 'Susu UHT',      'liter');

insert into bahan_stock (bahan_id, quantity) values
  ('44444444-4444-4444-8444-000000000001', 20),
  ('44444444-4444-4444-8444-000000000002', 15),
  ('44444444-4444-4444-8444-000000000003',  8),
  ('44444444-4444-4444-8444-000000000004', 24);

insert into bahan_movement (id, bahan_id, delta, balance_after, reason, created_by_admin_id, note)
select m.id, m.bahan_id, m.delta, m.balance_after, 'masuk',
       admin.id, 'Stok awal bahan seed dev'
from (values
  ('55555555-5555-5555-8555-000000000001'::uuid, '44444444-4444-4444-8444-000000000001'::uuid, 20, 20),
  ('55555555-5555-5555-8555-000000000002'::uuid, '44444444-4444-4444-8444-000000000002'::uuid, 15, 15),
  ('55555555-5555-5555-8555-000000000003'::uuid, '44444444-4444-4444-8444-000000000003'::uuid,  8,  8),
  ('55555555-5555-5555-8555-000000000004'::uuid, '44444444-4444-4444-8444-000000000004'::uuid, 24, 24)
) as m (id, bahan_id, delta, balance_after)
cross join lateral (
  select id from admin_users where email = 'owner@kedaidev.test' limit 1
) admin;

-- -------------------------------------------------- contoh produksi
-- 40 cup Kopi Susu Gula Aren dari gula + biji kopi, masuk gudang pusat.
-- Meniru record_produksi: produksi header dulu, lalu kurangi bahan, lalu
-- stok jadi + ledger di gudang.
insert into produksi
  (id, product_id, qty_hasil, produced_by_admin_id, note, produced_at)
select '66666666-6666-6666-8666-000000000001',
       '33333333-3333-4333-8333-000000000001', 40,
       admin.id, 'Produksi dev: racikan reguler', now()
from (select id from admin_users where email = 'owner@kedaidev.test' limit 1) admin;

insert into produksi_bahan (produksi_id, bahan_id, qty) values
  ('66666666-6666-6666-8666-000000000001', '44444444-4444-4444-8444-000000000001', 3),
  ('66666666-6666-6666-8666-000000000001', '44444444-4444-4444-8444-000000000002', 2);

-- Bahan berkurang (2 baris, masing-masing dengan saldo baru)
insert into bahan_movement (id, bahan_id, delta, balance_after, reason, ref_produksi_id, created_by_admin_id, note)
select m.id, m.bahan_id, m.delta, m.balance_after, 'produksi',
       '66666666-6666-6666-8666-000000000001', admin.id, 'Produksi dev'
from (values
  ('55555555-5555-5555-8555-000000000011'::uuid, '44444444-4444-4444-8444-000000000001'::uuid, -3, 17),
  ('55555555-5555-5555-8555-000000000012'::uuid, '44444444-4444-4444-8444-000000000002'::uuid, -2, 13)
) as m (id, bahan_id, delta, balance_after)
cross join lateral (
  select id from admin_users where email = 'owner@kedaidev.test' limit 1
) admin;

update bahan_stock set quantity = 17 where bahan_id = '44444444-4444-4444-8444-000000000001';
update bahan_stock set quantity = 13 where bahan_id = '44444444-4444-4444-8444-000000000002';

-- Stok jadi di gudang pusat + ledger
insert into kedai_stock (kedai_id, product_id, quantity)
values ('00000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-000000000001', 40);

insert into stock_movements
  (kedai_id, product_id, delta, balance_after, reason, ref_produksi_id, created_by_admin_id, note)
select '00000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-000000000001',
       40, 40, 'produksi', '66666666-6666-6666-8666-000000000001', admin.id, 'Produksi dev'
from (select id from admin_users where email = 'owner@kedaidev.test' limit 1) admin;
