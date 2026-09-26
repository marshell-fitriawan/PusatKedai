-- =====================================================================
-- Stok dua lapis: bahan mentah + produksi manual (M6, klien Malaysia)
--
-- Alur (docs/Database.md §9–§12):
--   1. Pemilik menambah stok bahan mentah di gudang pusat (manual, tanpa
--      pemasok) -> bahan_movement reason 'masuk'.
--   2. Produksi manual: banyak bahan menjadi satu produk jadi. Tidak ada
--      resep baku -- pemilik mengisi bahan & jumlah yang dipakai per run.
--      Hasil masuk gudang pusat (kedai.is_warehouse = true).
--   3. Dari gudang pusat, produk di-assign ke kedai lewat stock_mutations
--      (mekanisme lama, terpakai apa adanya).
--
-- INVARIANT yang dipegang sama dengan stock_movements: bahan_stock.quantity
-- hanya berubah bersama baris bahan_movement dalam satu DB transaction.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Gudang pusat = kedai dengan is_warehouse
-- ---------------------------------------------------------------------
alter table kedai
  add column if not exists is_warehouse boolean not null default false;

comment on column kedai.is_warehouse is
  'true = gudang pusat: tempat stok jadi berkumpul dari produksi dan menjadi sumber assign ke kedai. Tidak punya karyawan/transaksi/sesi.';

create index if not exists kedai_warehouse_idx on kedai (is_warehouse) where is_warehouse;

-- =====================================================================
-- 2. bahan_mentah (katalog)
-- =====================================================================
create table bahan_mentah (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null,
  -- Satuan bebas (gram, kg, bungkus, porsi). Tanpa konversi antar satuan.
  satuan      text        not null,
  -- Opsional, dipakai fase lanjut untuk modal per porsi.
  harga_beli  numeric(12, 2) check (harga_beli is null or harga_beli >= 0),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- 3. bahan_stock (saldo stok mentah -- satu baris per bahan, di pusat)
-- quantity SENGAJA boleh negatif, alasan sama dengan kedai_stock; koreksi
-- lewat bahan_movement reason 'koreksi'.
-- =====================================================================
create table bahan_stock (
  bahan_id   uuid primary key references bahan_mentah (id) on delete restrict,
  quantity   integer     not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create trigger bahan_stock_set_updated_at
  before update on bahan_stock
  for each row execute function set_updated_at();

-- =====================================================================
-- 4. produksi + produksi_bahan (banyak bahan -> satu produk jadi)
-- =====================================================================
create table produksi (
  id                   uuid primary key default gen_random_uuid(),
  product_id           uuid        not null references products (id) on delete restrict,
  qty_hasil            integer     not null check (qty_hasil > 0),
  produced_by_admin_id uuid        not null references admin_users (id) on delete restrict,
  note                 text,
  produced_at          timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create table produksi_bahan (
  id          uuid primary key default gen_random_uuid(),
  produksi_id uuid        not null references produksi (id) on delete cascade,
  bahan_id    uuid        not null references bahan_mentah (id) on delete restrict,
  qty         integer     not null check (qty > 0),
  unique (produksi_id, bahan_id)
);

create index produksi_bahan_produksi_idx on produksi_bahan (produksi_id);

-- =====================================================================
-- 5. bahan_movement (ledger stok mentah -- append-only)
-- =====================================================================
create table bahan_movement (
  id                 uuid primary key default gen_random_uuid(),
  bahan_id           uuid        not null references bahan_mentah (id) on delete restrict,
  -- negatif = keluar (produksi/koreksi), positif = masuk (penambahan manual)
  delta              integer     not null check (delta <> 0),
  balance_after      integer     not null,
  reason             text        not null check (
                       reason in ('masuk', 'produksi', 'koreksi')
                     ),
  ref_produksi_id    uuid        references produksi (id) on delete restrict,
  -- Hanya pemilik yang mengelola bahan; karyawan tidak pernah menyentuhnya.
  created_by_admin_id uuid       not null references admin_users (id) on delete restrict,
  note               text,
  created_at         timestamptz not null default clock_timestamp(),

  -- reason 'produksi' wajib menunjuk ke run produksi pemiliknya.
  constraint bahan_movement_produksi_needs_produksi check (
    reason <> 'produksi' or ref_produksi_id is not null
  ),

  -- Koreksi manual wajib punya alasan tertulis (sama seperti adjustment).
  constraint bahan_movement_koreksi_needs_note check (
    reason <> 'koreksi' or (note is not null and length(btrim(note)) > 0)
  )
);

create index bahan_movement_bahan_idx on bahan_movement (bahan_id, created_at desc);

-- Satu run produksi memakai satu bahan tepat satu kali -- pencegah pengurangan
-- ganda bila record_produksi dipanggil ulang (lapis kedua; lapis pertama
-- adalah idempotensi lewat produksi.id).
create unique index bahan_movement_once_per_produksi
  on bahan_movement (ref_produksi_id, bahan_id)
  where ref_produksi_id is not null;

-- =====================================================================
-- 6. stock_movements: tambah reason 'produksi' (produk jadi masuk gudang).
-- Constraint lama ditulis inline di 0001 sehingga bernama default; drop dulu
-- lalu tambah ulang dengan daftar yang diperluas NAMUN tetap eksplisit.
-- =====================================================================
alter table stock_movements
  drop constraint stock_movements_reason_check;

alter table stock_movements
  add column ref_produksi_id uuid references produksi (id) on delete restrict;

alter table stock_movements
  add constraint stock_movements_reason_check check (
    reason in ('initial', 'sale', 'void', 'mutation_out', 'mutation_in',
               'adjustment', 'produksi')
  );

alter table stock_movements
  add constraint movements_produksi_needs_produksi check (
    reason <> 'produksi' or ref_produksi_id is not null
  );

-- Idempotensi produksi: satu run menambah satu produk tepat satu kali.
create unique index movements_once_per_produksi
  on stock_movements (ref_produksi_id, product_id)
  where ref_produksi_id is not null;

-- =====================================================================
-- 7. RLS: pola sama dengan tabel lain -- admin full, selain itu ditolak.
-- =====================================================================
alter table bahan_mentah     enable row level security;
alter table bahan_stock      enable row level security;
alter table bahan_movement   enable row level security;
alter table produksi         enable row level security;
alter table produksi_bahan   enable row level security;

create policy admin_all on bahan_mentah
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy admin_all on bahan_stock
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy admin_all on bahan_movement
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy admin_all on produksi
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy admin_all on produksi_bahan
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

-- =====================================================================
-- 8. record_bahan_movement -- SATU-SATUNYA cara menambah/mengoreksi
--    stok mentah. menulis ledger + saldo dalam satu transaction.
--    reason: 'masuk' (penambahan manual) atau 'koreksi' (wajib note).
--    Idempoten per p_id (client mengirim UUID yang sama saat retry).
-- =====================================================================
create or replace function public.record_bahan_movement(
  p_id       uuid,
  p_bahan_id uuid,
  p_delta    integer,
  p_reason   text,
  p_note     text,
  p_admin_id uuid
)
returns table (quantity integer, reason text)
language plpgsql
as $$
declare
  v_saldo integer;
begin
  -- Idempoten: penambahan yang sudah masuk (mis. retry form) dikembalikan
  -- apa adanya, tidak menambah stok dua kali.
  select bs.quantity into v_saldo
  from bahan_stock bs
  where bs.bahan_id = p_bahan_id;
  v_saldo := coalesce(v_saldo, 0);

  if exists (select 1 from bahan_movement where id = p_id) then
    quantity := v_saldo;
    reason   := p_reason;
    return next;
    return;
  end if;

  if p_reason not in ('masuk', 'koreksi') then
    raise exception 'reason produksi tidak lewat fungsi ini'
      using errcode = 'check_violation';
  end if;

  if p_delta = 0 then
    raise exception 'delta tidak boleh nol' using errcode = 'check_violation';
  end if;

  -- Kunci baris: dua form admin yang simpan bersamaan dihitung berurutan.
  select bs.quantity into v_saldo
  from bahan_stock bs
  where bs.bahan_id = p_bahan_id
  for update;
  v_saldo := coalesce(v_saldo, 0);

  insert into bahan_stock (bahan_id, quantity)
  values (p_bahan_id, v_saldo + p_delta)
  on conflict (bahan_id) do update
    set quantity = bahan_stock.quantity + p_delta
  returning bahan_stock.quantity into v_saldo;

  insert into bahan_movement (
    id, bahan_id, delta, balance_after, reason, created_by_admin_id, note
  ) values (
    p_id, p_bahan_id, p_delta, v_saldo, p_reason, p_admin_id, p_note
  );

  quantity := v_saldo;
  reason   := p_reason;
  return next;
end;
$$;

-- =====================================================================
-- 9. record_produksi -- banyak bahan menjadi satu produk jadi di gudang
--    pusat. Satu transaction:
--      1. cek & kurangi tiap bahan (bahan_movement reason 'produksi')
--      2. tulis produksi + produksi_bahan
--      3. tambah stok produk jadi gudang pusat (stock_movements 'produksi')
--
--    Idempoten per p_id; array bahan/qty urutannya berpasangan.
-- =====================================================================
create or replace function public.record_produksi(
  p_id         uuid,
  p_product_id uuid,
  p_qty_hasil  integer,
  p_bahan_ids  uuid[],
  p_qty_pakai  integer[],
  p_admin_id   uuid,
  p_note       text
)
returns table (produksi_id uuid, product_id uuid, qty_hasil integer, produced_at timestamptz)
language plpgsql
as $$
-- Nama output (produksi_id, product_id, ...) bertabrakan dengan nama kolom pada
-- insert/on conflict yang sama; arahkan resolusi ke kolom di dalam statement SQL.
#variable_conflict use_column
declare
  v_warehouse uuid;
  v_saldo     integer;
  v_bahan     uuid;
  v_pakai     integer;
  v_saldo_wh  integer;
  i           integer;
  n           integer;
begin
  if p_qty_hasil is null or p_qty_hasil <= 0 then
    raise exception 'Jumlah hasil produksi harus > 0' using errcode = 'check_violation';
  end if;

  n := array_length(p_bahan_ids, 1);
  if n is null or n = 0 then
    raise exception 'Produksi tanpa bahan' using errcode = 'check_violation';
  end if;
  if array_length(p_qty_pakai, 1) <> n then
    raise exception 'Jumlah bahan dan jumlah pemakaian tidak cocok'
      using errcode = 'check_violation';
  end if;
  if array_length(array(select distinct unnest(p_bahan_ids)), 1) <> n then
    raise exception 'Ada bahan duplikat dalam satu produksi' using errcode = 'check_violation';
  end if;

  -- Idempoten: pemanggilan ulang mengembalikan hasil yang sudah ada.
  select p.id, p.product_id, p.qty_hasil, p.produced_at
    into produksi_id, product_id, qty_hasil, produced_at
  from produksi p
  where p.id = p_id;

  if found then
    return next;
    return;
  end if;

  -- Gudang pusat wajib ada; hasil produksi selalu masuk ke sini.
  select k.id into v_warehouse
  from kedai k
  where k.is_warehouse
  order by k.created_at
  limit 1;

  if v_warehouse is null then
    raise exception 'Gudang pusat belum diaktifkan (tandai satu kedai sebagai is_warehouse)'
      using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------
  -- 1. Header produksi ditulis LEBIH DULU dari baris bahan: bahan_movement
  --    punya FK ref_produksi_id -> produksi(id).
  -- ---------------------------------------------------------------
  insert into produksi (
    id, product_id, qty_hasil, produced_by_admin_id, note
  ) values (
    p_id, p_product_id, p_qty_hasil, p_admin_id, p_note
  );

  -- ---------------------------------------------------------------
  -- 2. Bahan: cek cukup (for update) lalu kurangi.
  -- ---------------------------------------------------------------
  for i in 1 .. n loop
    v_bahan := p_bahan_ids[i];
    v_pakai := p_qty_pakai[i];

    if v_pakai is null or v_pakai <= 0 then
      raise exception 'Jumlah pemakaian bahan harus > 0' using errcode = 'check_violation';
    end if;

    select bs.quantity into v_saldo
    from bahan_stock bs
    where bs.bahan_id = v_bahan
    for update;
    v_saldo := coalesce(v_saldo, 0);

    if v_saldo < v_pakai then
      raise exception 'Stok bahan tidak mencukupi (tersedia %, butuh %)',
        v_saldo, v_pakai
        using errcode = 'P0001';
    end if;

    update bahan_stock
       set quantity = quantity - v_pakai
     where bahan_id = v_bahan;

    insert into bahan_movement (
      bahan_id, delta, balance_after, reason,
      ref_produksi_id, created_by_admin_id
    ) values (
      v_bahan, -v_pakai, v_saldo - v_pakai, 'produksi',
      p_id, p_admin_id
    );
  end loop;

  -- ---------------------------------------------------------------
  -- 3. Rincian bahan yang dipakai
  -- ---------------------------------------------------------------
  for i in 1 .. n loop
    insert into produksi_bahan (produksi_id, bahan_id, qty)
    values (p_id, p_bahan_ids[i], p_qty_pakai[i]);
  end loop;

  -- ---------------------------------------------------------------
  -- 4. Produk jadi masuk gudang pusat (saldo + ledger sekaligus)
  -- ---------------------------------------------------------------
  select ks.quantity into v_saldo_wh
  from kedai_stock ks
  where ks.kedai_id = v_warehouse and ks.product_id = p_product_id
  for update;
  v_saldo_wh := coalesce(v_saldo_wh, 0);

  insert into kedai_stock (kedai_id, product_id, quantity)
  values (v_warehouse, p_product_id, v_saldo_wh + p_qty_hasil)
  on conflict (kedai_id, product_id) do update
    set quantity = kedai_stock.quantity + p_qty_hasil
  returning kedai_stock.quantity into v_saldo_wh;

  insert into stock_movements (
    kedai_id, product_id, delta, balance_after, reason,
    ref_produksi_id, created_by_admin_id, note
  ) values (
    v_warehouse, p_product_id, p_qty_hasil, v_saldo_wh, 'produksi',
    p_id, p_admin_id, p_note
  );

  produksi_id := p_id;
  product_id  := p_product_id;
  qty_hasil   := p_qty_hasil;
  produced_at := clock_timestamp();
  return next;
end;
$$;

-- Seperti fungsi lain: hanya service_role yang boleh memanggil. PostgREST
-- mengekspos fungsi di public sebagai endpoint RPC; tanpa revoke, siapa pun
-- dengan anon key bisa menambah stok bahan / menjalankan produksi palsu.
revoke all on function public.record_bahan_movement(uuid, uuid, integer, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.record_produksi(uuid, uuid, integer, uuid[], integer[], uuid, text)
  from public, anon, authenticated;