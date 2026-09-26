-- =====================================================================
-- 0014 — M7: Sesi, Blind Closing & Collect (klien Malaysia)
--
-- 1. Hapus `attendance` (keputusan desain 14: satu kedai satu karyawan).
-- 2. Stok hilang sah -> ledger reason `waste` + tabel `waste (alasan wajib)`.
-- 3. Hitung fisik saat tutup -> tabel `sisa_fisik` per shift per produk.
-- 4. Status selisih kas per shift untuk halaman Collect pemilik (M7-5).
-- 5. `notifikasi` in-app untuk halaman Perlu Perhatian (M7-6).
--
-- Catatan: blind closing (M7-1) adalah perubahan payload/UI, bukan skema.
-- Selisih stok dihitung saat Collect (keputusan 11) -- tidak disimpan.
-- =====================================================================

begin;

-- =====================================================================
-- 1. attendance dihapus (keputusan desain 14).
-- =====================================================================
drop table if exists public.attendance;

-- =====================================================================
-- 2. stock_movements: reason `waste` + tautan ke tabel waste.
-- =====================================================================
alter table public.stock_movements
  add column ref_waste_id uuid;

-- Perluas daftar reason: drop by name lalu add ulang (pola sama dengan 0013).
alter table public.stock_movements
  drop constraint stock_movements_reason_check;
alter table public.stock_movements
  add constraint stock_movements_reason_check
  check (reason in (
    'initial', 'sale', 'void', 'mutation_out', 'mutation_in',
    'adjustment', 'produksi', 'waste'
  ));

-- Movement reason `waste` WAJIB menunjuk waste (pola sama dengan
-- movements_sale_needs_transaction); movement lain tidak boleh menyebutnya.
alter table public.stock_movements
  add constraint movements_waste_needs_waste
  check ((reason = 'waste') = (num_nonnulls(ref_waste_id) = 1));

create unique index movements_once_per_waste
  on public.stock_movements (ref_waste_id)
  where ref_waste_id is not null;

-- =====================================================================
-- 3. waste — stok hilang yang SAH (rusak, tumpah, dll), alasan wajib.
--    Selalu ditulis bersama 1 movement `waste` (lewat record_waste).
-- =====================================================================
create table public.waste (
  id                     uuid         primary key default gen_random_uuid(),
  kedai_id               uuid         not null references public.kedai (id) on delete restrict,
  shift_id               uuid         references public.shifts (id) on delete set null,
  product_id             uuid         not null references public.products (id) on delete restrict,
  quantity               integer      not null check (quantity > 0),
  alasan                 text         not null check (length(btrim(alasan)) >= 3),
  recorded_by_employee_id uuid        not null references public.employees (id) on delete restrict,
  recorded_at            timestamptz  not null default now()
);

comment on table public.waste is
  'Stok hilang sah (rusak, tumpah, lewat masa simpan). Setiap baris punya satu stock_movements reason waste lewat movements_once_per_waste; stok jadi ternilai, alasan wajib untuk audit.';

create index waste_kedai_at_idx on public.waste (kedai_id, recorded_at desc);
create index waste_shift_idx   on public.waste (shift_id);

alter table public.stock_movements
  add constraint stock_movements_ref_waste_id_fkey
  foreign key (ref_waste_id) references public.waste (id);

-- =====================================================================
-- 4. sisa_fisik — hitung fisik per produk saat tutup (input buta, M7-2).
--    Selisih stok per produk dihitung di Collect:
--      terjual_tercatat - (saldo ledger saat tutup - sisa_fisik - waste)
--    TIDAK ada snapshot stok saat buka (keputusan desain 11).
-- =====================================================================
create table public.sisa_fisik (
  id          uuid        primary key default gen_random_uuid(),
  shift_id    uuid        not null references public.shifts (id) on delete cascade,
  product_id  uuid        not null references public.products (id) on delete restrict,
  quantity    integer     not null check (quantity >= 0),
  created_at  timestamptz not null default now(),
  unique (shift_id, product_id)
);

comment on table public.sisa_fisik is
  'Hasil hitung fisik produk saat tutup. Satu baris per (shift, produk) -- kasir mengisi angka terkini, selisih dengan ledger jadi bahan Collect pemilik.';

create index sisa_fisik_shift_idx on public.sisa_fisik (shift_id);

-- =====================================================================
-- 5. shifts: status selisih kas untuk alur Collect (M7-5).
--    terbuka -> dijelaskan (selisih wajar, tercatat) / rugi (dicatat).
-- =====================================================================
alter table public.shifts
  add column difference_status text not null default 'terbuka'
    check (difference_status in ('terbuka', 'dijelaskan', 'rugi'));
alter table public.shifts
  add column difference_note text;

-- =====================================================================
-- 6. notifikasi in-app (M7-6) -- belum dibaca pemilik = is_read false.
-- =====================================================================
create table public.notifikasi (
  id          uuid        primary key default gen_random_uuid(),
  kedai_id    uuid        references public.kedai (id) on delete set null,
  shift_id    uuid        references public.shifts (id) on delete set null,
  type        text        not null check (type in (
                            'shift_selesai', 'selisih', 'stock_low',
                            'void_review', 'device_stale', 'assign', 'produksi'
                          )),
  title       text        not null,
  message     text,
  is_read     boolean     not null default false,
  created_at  timestamptz not null default now()
);

create index notifikasi_unread_idx on public.notifikasi (is_read, created_at desc);
create index notifikasi_kedai_idx  on public.notifikasi (kedai_id, created_at desc);

-- =====================================================================
-- 7. RLS: pola sama -- admin full, selain itu ditolak.
--    (POS adalah karyawan tanpa akun auth; semua operasinya lewat
--    server action + admin client, jadi RLS yang membuka untuk
--    `authenticated` hanyalah admin pusat.)
-- =====================================================================
alter table public.waste      enable row level security;
alter table public.sisa_fisik enable row level security;
alter table public.notifikasi enable row level security;

create policy admin_all on public.waste
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy admin_all on public.sisa_fisik
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
create policy admin_all on public.notifikasi
  for all to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

-- =====================================================================
-- 8. record_waste -- SATU-SATUNYA cara mencatat stok hilang sah.
--    Menulis waste + movement reason `waste` + kurangi saldo dalam satu
--    transaction. Idempoten per p_id (retry tidak menggandakan).
-- =====================================================================
create or replace function public.record_waste(
  p_id         uuid,
  p_kedai_id   uuid,
  p_shift_id   uuid,
  p_product_id uuid,
  p_quantity   integer,
  p_alasan     text,
  p_employee_id uuid
)
returns table (quantity integer)
language plpgsql
as $$
declare
  v_saldo   integer;
  v_baru    integer;
begin
  -- Idempoten: waste yang sudah tercatat (retry form) dikembalikan apa
  -- adanya tanpa memotong stok dua kali.
  if exists (select 1 from public.waste where id = p_id) then
    select ks.quantity into quantity
    from public.kedai_stock ks
    where ks.kedai_id = p_kedai_id and ks.product_id = p_product_id;
    quantity := coalesce(quantity, 0);
    return next;
    return;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Jumlah waste harus lebih dari nol'
      using errcode = 'check_violation';
  end if;
  if p_alasan is null or length(btrim(p_alasan)) < 3 then
    raise exception 'Alasan waste wajib diisi (minimal 3 karakter)'
      using errcode = 'check_violation';
  end if;

  -- Kunci baris: dua perangkat mencatat waste bersamaan dihitung berurutan.
  select ks.quantity into v_saldo
  from public.kedai_stock ks
  where ks.kedai_id = p_kedai_id and ks.product_id = p_product_id
  for update;
  v_saldo := coalesce(v_saldo, 0);

  if v_saldo < p_quantity then
    raise exception 'Stok tidak cukup: tersedia %, diminta %', v_saldo, p_quantity
      using errcode = 'check_violation';
  end if;

  v_baru := v_saldo - p_quantity;

  insert into public.waste (
    id, kedai_id, shift_id, product_id, quantity, alasan, recorded_by_employee_id
  ) values (
    p_id, p_kedai_id, p_shift_id, p_product_id, p_quantity,
    btrim(p_alasan), p_employee_id
  );

  insert into public.kedai_stock (kedai_id, product_id, quantity)
  values (p_kedai_id, p_product_id, v_baru)
  on conflict (kedai_id, product_id) do update
    set quantity = v_baru;

  insert into public.stock_movements (
    kedai_id, product_id, delta, balance_after, reason, ref_waste_id,
    created_by_employee_id, note
  ) values (
    p_kedai_id, p_product_id, -p_quantity, v_baru, 'waste', p_id,
    p_employee_id, btrim(p_alasan)
  );

  quantity := v_baru;
  return next;
end;
$$;

revoke all on function public.record_waste(uuid, uuid, uuid, uuid, integer, text, uuid)
  from public, anon, authenticated;

commit;