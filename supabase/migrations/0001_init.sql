-- =====================================================================
-- Sistem Multi-Kedai — skema awal
-- Sumber: docs/Database.md
--
-- Satu instance = satu bisnis (banyak kedai di dalamnya), jadi TIDAK ADA
-- kolom tenant_id. Semua tabel operasional discope oleh kedai_id.
--
-- Status enum sengaja dipakai text + CHECK (bukan tipe ENUM Postgres)
-- supaya menambah nilai baru tidak perlu ALTER TYPE yang mengunci tabel.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Helper: jaga kolom updated_at
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 1. kedai (cabang)
-- =====================================================================
create table kedai (
  id                  uuid primary key default gen_random_uuid(),
  name                text        not null,
  address             text,
  phone               text,
  -- Dipakai untuk menentukan business_date transaksi/shift.
  timezone            text        not null default 'Asia/Jakarta',
  -- Ambang batas badge "stok menipis" (docs/design_1.md: warning).
  low_stock_threshold integer     not null default 5 check (low_stock_threshold >= 0),
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now()
);

-- =====================================================================
-- 2. admin_users (owner / admin pusat)
-- id = user id dari Supabase Auth (login email/password).
-- =====================================================================
create table admin_users (
  id         uuid primary key references auth.users (id) on delete restrict,
  name       text        not null,
  email      text        not null unique,
  role       text        not null check (role in ('owner', 'admin_pusat')),
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3. employees (karyawan/kasir per kedai)
-- Login lewat QR pribadi, bukan Supabase Auth.
-- =====================================================================
create table employees (
  id         uuid primary key default gen_random_uuid(),
  kedai_id   uuid        not null references kedai (id) on delete restrict,
  name       text        not null,
  role       text        not null check (role in ('kasir', 'admin_kedai')),
  qr_token   text        not null unique,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

create index employees_kedai_idx on employees (kedai_id) where is_active;

-- =====================================================================
-- 4. products (katalog shared seluruh kedai — hanya stok yang per kedai)
-- =====================================================================
create table products (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  price      numeric(12, 2) not null check (price >= 0),
  category   text,
  image_url  text,
  is_active  boolean     not null default true,
  created_at timestamptz not null default now()
);

create index products_active_idx on products (category) where is_active;

-- =====================================================================
-- 5. shifts (buka/tutup toko + rekonsiliasi kas)
-- =====================================================================
create table shifts (
  id                    uuid primary key default gen_random_uuid(),
  kedai_id              uuid        not null references kedai (id) on delete restrict,
  business_date         date        not null,
  opened_by             uuid        not null references employees (id) on delete restrict,
  closed_by             uuid        references employees (id) on delete restrict,
  opening_cash          numeric(12, 2) not null check (opening_cash >= 0),
  closing_cash          numeric(12, 2),
  -- Dihitung server, bukan client: opening_cash + transaksi tunai completed.
  expected_cash         numeric(12, 2),
  cash_difference       numeric(12, 2),
  -- pending_sync = masih ada transaksi di antrian offline, angka kas belum final.
  reconciliation_status text        not null default 'final'
                                    check (reconciliation_status in ('pending_sync', 'final')),
  reconciled_at         timestamptz,
  opened_at             timestamptz not null default now(),
  closed_at             timestamptz,
  status                text        not null default 'open'
                                    check (status in ('open', 'closed')),

  -- Shift tertutup wajib punya jejak siapa dan kapan.
  constraint shifts_closed_complete check (
    status <> 'closed' or (closed_at is not null and closed_by is not null)
  )
);

-- Hanya boleh ada satu shift terbuka per kedai pada satu waktu.
create unique index shifts_one_open_per_kedai
  on shifts (kedai_id)
  where status = 'open';

create index shifts_kedai_date_idx on shifts (kedai_id, business_date desc);

-- =====================================================================
-- 6. attendance (absensi via scan QR)
-- =====================================================================
create table attendance (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid        not null references employees (id) on delete restrict,
  kedai_id     uuid        not null references kedai (id) on delete restrict,
  shift_id     uuid        references shifts (id) on delete set null,
  clock_in_at  timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at   timestamptz not null default now(),

  constraint attendance_clock_order check (
    clock_out_at is null or clock_out_at >= clock_in_at
  )
);

-- Cegah dua clock-in terbuka untuk karyawan yang sama.
create unique index attendance_one_open_per_employee
  on attendance (employee_id)
  where clock_out_at is null;

create index attendance_kedai_idx on attendance (kedai_id, clock_in_at desc);

-- =====================================================================
-- 7. kedai_stock (saldo stok per kedai)
-- CATATAN: quantity SENGAJA boleh negatif. Kasir bisa offline dengan cache
-- stok basi, dan memblokir penjualan di F&B lebih merugikan daripada stok
-- tercatat minus. Stok <= 0 ditandai badge danger di UI, dikoreksi lewat
-- stock_movements dengan reason 'adjustment'.
-- =====================================================================
create table kedai_stock (
  id         uuid primary key default gen_random_uuid(),
  kedai_id   uuid        not null references kedai (id) on delete restrict,
  product_id uuid        not null references products (id) on delete restrict,
  quantity   integer     not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (kedai_id, product_id)
);

create trigger kedai_stock_set_updated_at
  before update on kedai_stock
  for each row execute function set_updated_at();

-- =====================================================================
-- 8. stock_mutations (mutasi antar kedai — wajib approval admin pusat)
-- =====================================================================
create table stock_mutations (
  id                       uuid primary key default gen_random_uuid(),
  from_kedai_id            uuid        not null references kedai (id) on delete restrict,
  to_kedai_id              uuid        not null references kedai (id) on delete restrict,
  product_id               uuid        not null references products (id) on delete restrict,
  quantity                 integer     not null check (quantity > 0),
  status                   text        not null default 'pending'
                                       check (status in ('pending', 'approved', 'rejected')),
  -- Pengaju bisa karyawan kedai ATAU admin pusat. Postgres tidak bisa membuat
  -- satu kolom FK yang menunjuk dua tabel, jadi dipecah dua kolom nullable
  -- dengan CHECK tepat satu terisi -- integritas tetap dijaga database.
  requested_by_employee_id uuid        references employees (id) on delete restrict,
  requested_by_admin_id    uuid        references admin_users (id) on delete restrict,
  approved_by              uuid        references admin_users (id) on delete restrict,
  requested_at             timestamptz not null default now(),
  approved_at              timestamptz,
  executed_at              timestamptz,
  note                     text,
  created_at               timestamptz not null default now(),

  constraint mutations_different_kedai check (from_kedai_id <> to_kedai_id),

  constraint mutations_one_requester check (
    num_nonnulls(requested_by_employee_id, requested_by_admin_id) = 1
  ),

  constraint mutations_approved_complete check (
    status <> 'approved' or (approved_by is not null and approved_at is not null)
  ),

  constraint mutations_rejected_needs_note check (
    status <> 'rejected' or (note is not null and length(btrim(note)) > 0)
  )
);

create index mutations_pending_idx on stock_mutations (requested_at desc) where status = 'pending';
create index mutations_from_idx on stock_mutations (from_kedai_id, requested_at desc);
create index mutations_to_idx on stock_mutations (to_kedai_id, requested_at desc);

-- =====================================================================
-- 9. transactions (penjualan)
-- id dibuat di CLIENT sebagai UUID supaya transaksi offline langsung punya
-- identitas unik dan sync-nya idempotent.
-- =====================================================================
create table transactions (
  id                 uuid primary key,
  kedai_id           uuid        not null references kedai (id) on delete restrict,
  shift_id           uuid        not null references shifts (id) on delete restrict,
  employee_id        uuid        not null references employees (id) on delete restrict,
  -- Ditetapkan server dari created_at + kedai.timezone.
  business_date      date        not null,
  -- Nomor sementara buatan device saat offline, mis. OFF-7K2M-0013.
  local_number       text        not null,
  -- Nomor final, ditetapkan server saat transaksi diterima. Null selama
  -- transaksi masih di antrian lokal.
  transaction_number text,
  subtotal           numeric(12, 2) not null check (subtotal >= 0),
  total              numeric(12, 2) not null check (total >= 0),
  payment_method     text        not null check (payment_method in ('tunai', 'qris')),
  status             text        not null default 'completed'
                                 check (status in ('completed', 'void')),
  voided_at          timestamptz,
  voided_by          uuid        references employees (id) on delete restrict,
  device_id          text        not null,
  synced_at          timestamptz not null default now(),
  -- Waktu transaksi dibuat DI DEVICE, bukan waktu sampai server.
  created_at         timestamptz not null,

  constraint transactions_void_complete check (
    status <> 'void' or (voided_at is not null and voided_by is not null)
  )
);

-- Nomor final unik per kedai per hari operasional.
create unique index transactions_number_per_day
  on transactions (kedai_id, business_date, transaction_number)
  where transaction_number is not null;

-- Nomor sementara unik per device (mencegah device mengirim dua transaksi
-- berbeda dengan label yang sama ke kasir/pelanggan).
create unique index transactions_local_number_per_device
  on transactions (device_id, local_number);

create index transactions_kedai_date_idx on transactions (kedai_id, business_date desc);
create index transactions_shift_idx on transactions (shift_id);

-- =====================================================================
-- 10. transaction_items
-- Menyimpan snapshot nama & harga supaya histori tidak berubah kalau
-- katalog produk diedit belakangan.
-- =====================================================================
create table transaction_items (
  id                    uuid primary key,
  transaction_id        uuid        not null references transactions (id) on delete cascade,
  product_id            uuid        not null references products (id) on delete restrict,
  product_name_snapshot text        not null,
  price_snapshot        numeric(12, 2) not null check (price_snapshot >= 0),
  qty                   integer     not null check (qty > 0),
  subtotal              numeric(12, 2) not null check (subtotal >= 0),
  created_at            timestamptz not null default now()
);

create index transaction_items_tx_idx on transaction_items (transaction_id);

-- =====================================================================
-- 11. stock_movements (ledger append-only)
-- Sumber kebenaran pergerakan stok. kedai_stock.quantity adalah saldo
-- turunan yang selalu ditulis dalam DB transaction yang sama dengan ledger.
-- =====================================================================
create table stock_movements (
  id                     uuid primary key default gen_random_uuid(),
  kedai_id               uuid        not null references kedai (id) on delete restrict,
  product_id             uuid        not null references products (id) on delete restrict,
  -- negatif = stok keluar, positif = stok masuk
  delta                  integer     not null check (delta <> 0),
  balance_after          integer     not null,
  reason                 text        not null check (
                           reason in ('initial', 'sale', 'void', 'mutation_out', 'mutation_in', 'adjustment')
                         ),
  ref_transaction_id     uuid        references transactions (id) on delete restrict,
  ref_mutation_id        uuid        references stock_mutations (id) on delete restrict,
  created_by_employee_id uuid        references employees (id) on delete restrict,
  created_by_admin_id    uuid        references admin_users (id) on delete restrict,
  note                   text,
  created_at             timestamptz not null default now(),

  constraint movements_sale_needs_transaction check (
    reason not in ('sale', 'void') or ref_transaction_id is not null
  ),

  constraint movements_mutation_needs_mutation check (
    reason not in ('mutation_out', 'mutation_in') or ref_mutation_id is not null
  ),

  -- Koreksi manual wajib punya alasan tertulis, kalau tidak jejak auditnya
  -- tidak ada gunanya.
  constraint movements_adjustment_needs_note check (
    reason <> 'adjustment' or (note is not null and length(btrim(note)) > 0)
  ),

  constraint movements_one_actor check (
    num_nonnulls(created_by_employee_id, created_by_admin_id) <= 1
  )
);

-- IDEMPOTENSI SYNC: kalau batch sync yang sama dikirim ulang, pengurangan
-- stok kedua ditolak DATABASE -- tidak bergantung pada logika aplikasi yang
-- justru paling rawan salah di jalur offline/retry.
create unique index movements_once_per_transaction
  on stock_movements (ref_transaction_id, product_id, reason)
  where ref_transaction_id is not null;

-- IDEMPOTENSI APPROVAL: approve dobel tidak bisa memindahkan stok dua kali.
create unique index movements_once_per_mutation
  on stock_movements (ref_mutation_id, reason)
  where ref_mutation_id is not null;

create index movements_kedai_product_idx
  on stock_movements (kedai_id, product_id, created_at desc);

-- =====================================================================
-- 12. expenses (pengeluaran operasional)
-- =====================================================================
create table expenses (
  id                      uuid primary key default gen_random_uuid(),
  kedai_id                uuid        not null references kedai (id) on delete restrict,
  category                text        not null check (
                            category in ('bahan_baku', 'listrik', 'sewa', 'gaji', 'lainnya')
                          ),
  description             text        not null,
  amount                  numeric(12, 2) not null check (amount > 0),
  expense_date            date        not null,
  recorded_by_employee_id uuid        references employees (id) on delete restrict,
  recorded_by_admin_id    uuid        references admin_users (id) on delete restrict,
  created_at              timestamptz not null default now(),

  -- Alasan sama dengan stock_mutations: pencatat bisa karyawan atau admin,
  -- tapi tepat satu.
  constraint expenses_one_recorder check (
    num_nonnulls(recorded_by_employee_id, recorded_by_admin_id) = 1
  )
);

create index expenses_kedai_date_idx on expenses (kedai_id, expense_date desc);
