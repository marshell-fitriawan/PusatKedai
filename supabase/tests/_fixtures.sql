-- =====================================================================
-- Fixture bersama untuk seluruh uji di supabase/tests/.
--
-- File ini DISISIPKAN oleh scripts/db.mjs pada baris penanda
-- `-- @include _fixtures.sql` di DALAM transaction tiap uji, sehingga
-- semua baris di sini ikut di-ROLLBACK bersama uji itu sendiri.
--
-- Isinya persis entitas "kanonik" dari supabase/seed.sql (kedai Melati &
-- Kenanga + gudang pusat, kasir Rina/Budi/Sari, produk contoh) yang
-- diandalkan banyak uji lewat UUID tetapnya. `npm run seed` sudah membuat
-- entitas ini; `npm run seed:minggu` TIDAK membuatnya -- fixture ini
-- menjamin uji lulus terlepas dari seed mana yang sedang dipakai dev DB.
--
-- Semua insert memakai ON CONFLICT DO NOTHING sehingga idempoten (aman
-- dijalankan berulang terhadap DB yang sudah ber-seed penuh).
-- =====================================================================

insert into kedai (id, name, address, phone, timezone, low_stock_threshold) values
  ('11111111-1111-4111-8111-000000000001', 'Kedai Melati',  'Jl. Melati No. 12, Bandung', '022-1110001', 'Asia/Kuala_Lumpur', 10),
  ('11111111-1111-4111-8111-000000000002', 'Kedai Kenanga', 'Jl. Kenanga No. 5, Bandung', '022-1110002', 'Asia/Kuala_Lumpur', 5),
  ('00000000-0000-4000-8000-000000000001', 'Gudang Pusat',  'Gudang pusat (tidak menjual)', NULL,         'Asia/Kuala_Lumpur', 5)
on conflict (id) do nothing;

update kedai set is_warehouse = true where id = '00000000-0000-4000-8000-000000000001';

insert into employees (id, kedai_id, name, role, qr_token) values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Rina Kasir',  'kasir',       'DEV-QR-RINA-0001'),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 'Budi Kepala', 'admin_kedai', 'DEV-QR-BUDI-0002'),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000002', 'Sari Kasir',  'kasir',       'DEV-QR-SARI-0003')
on conflict (id) do nothing;

insert into products (id, name, price, category) values
  ('33333333-3333-4333-8333-000000000001', 'Kopi Susu Gula Aren', 22000, 'kopi'),
  ('33333333-3333-4333-8333-000000000002', 'Americano',           18000, 'kopi'),
  ('33333333-3333-4333-8333-000000000003', 'Cappuccino',          25000, 'kopi')
on conflict (id) do nothing;

-- Stok awal kedua kedai + ledger, mengikuti aturan yang sama dengan seed:
-- saldo dan baris stock_movements ('initial') ditulis bersamaan. Diabaikan
-- bila baris stok sudah ada (DB ber-seed penuh).
with target as (
  select s.kedai_id, s.product_id, s.qty
  from (values
    ('11111111-1111-4111-8111-000000000001'::uuid, '33333333-3333-4333-8333-000000000001'::uuid, 40),
    ('11111111-1111-4111-8111-000000000001'::uuid, '33333333-3333-4333-8333-000000000002'::uuid, 40),
    ('11111111-1111-4111-8111-000000000002'::uuid, '33333333-3333-4333-8333-000000000001'::uuid, 25),
    ('11111111-1111-4111-8111-000000000002'::uuid, '33333333-3333-4333-8333-000000000002'::uuid, 25)
  ) as s(kedai_id, product_id, qty)
  where not exists (
    select 1 from kedai_stock r
    where r.kedai_id = s.kedai_id and r.product_id = s.product_id
  )
),
inserted as (
  insert into kedai_stock (kedai_id, product_id, quantity)
  select kedai_id, product_id, qty from target
  returning kedai_id, product_id, quantity
)
insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, note)
select kedai_id, product_id, quantity, quantity, 'initial', 'Stok awal fixture uji'
from inserted;