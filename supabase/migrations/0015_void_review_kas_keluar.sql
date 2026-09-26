-- =====================================================================
-- 0015 — M8: Void perlu review (M8-1) + kas keluar terkait sesi (M8-3)
--
-- M8-1 (keputusan desain 12): void TIDAK lagi instan. Kasir hanya bisa
-- MENGAJUKAN void (status transaksi -> `perlu_review`, stok TIDAK kembali).
-- Pemilik menyetujui (-> void + stok balik via ledger `void`) atau menolak
-- (-> kembali `completed`). `void_request` mencatat alasan pengajuan dan
-- jejak keputusan admin. Fungsi lama `void_transaction` tetap ada sebagai
-- mekanisme inti yang dipanggil (logikanya disalin ke `decide_void` karena
-- void pasca-tutup oleh admin TIDAK boleh diblokir guard shift-terbuka).
--
-- M8-3: kas keluar yang diambil dari laci mengubah setoran seharusnya.
-- `expenses` mendapat `shift_id` (sesi mana uangnya keluar) + `from_cash`
-- (apakah mengurangi kas laci). `reconcile_shift` memotongnya dari expected:
--   expected_cash = opening + penjualan tunai - kas keluar dari laci
-- =====================================================================

begin;

-- =====================================================================
-- 1. M8-1: transaksi boleh berstatus `perlu_review`.
-- =====================================================================
alter table public.transactions
  drop constraint transactions_status_check;
alter table public.transactions
  add constraint transactions_status_check
  check (status in ('completed', 'void', 'perlu_review'));

comment on column public.transactions.status is
  'completed | void | perlu_review (M8-1: menunggu keputusan pemilik; stok tidak dikembalikan sebelum disetujui).';

-- =====================================================================
-- 2. void_request — pengajuan void kasir + keputusan pemilik.
-- =====================================================================
create table public.void_request (
  id                      uuid primary key default gen_random_uuid(),
  transaction_id          uuid        not null references public.transactions (id) on delete restrict,
  kedai_id                uuid        not null references public.kedai (id) on delete restrict,
  requested_by_employee_id uuid       not null references public.employees (id) on delete restrict,
  alasan                  text        not null
                            check (char_length(btrim(alasan)) >= 3),
  status                  text        not null default 'pending'
                            check (status in ('pending', 'approved', 'rejected')),
  decided_by              uuid        references public.admin_users (id) on delete restrict,
  decided_at              timestamptz,
  note                    text,
  created_at              timestamptz not null default now(),

  -- Keputusan harus lengkap: approved/rejected wajib punya siapa+kapan.
  constraint void_request_decision_complete check (
    status = 'pending' or (decided_by is not null and decided_at is not null)
  ),
  -- Penolakan wajib beralasan (berlawanan dengan approval yang boleh diam).
  constraint void_request_rejected_needs_note check (
    status <> 'rejected' or (note is not null and char_length(btrim(note)) >= 1)
  )
);

-- Satu pengajuan PENDING per transaksi; setelah diputuskan, kasir boleh
-- mengajukan ulang (baris baru) kalau transaksi balik ke `completed`.
create unique index void_request_one_pending
  on public.void_request (transaction_id)
  where status = 'pending';

-- Daftar antrean pemilik (status pending saja) + jejak per kedai.
create index void_request_pending_idx on public.void_request (status, created_at desc)
  where status = 'pending';
create index void_request_kedai_idx on public.void_request (kedai_id, created_at desc);

comment on table public.void_request is
  'Pengajuan pembatalan transaksi oleh kasir. Transaksi masuk status `perlu_review`; stok TIDAK dikembalikan sampai pemilik menyetujui (decide_void).';

-- =====================================================================
-- 3. request_void — kasir mengajukan pembatalan (M8-1).
-- =====================================================================
create or replace function public.request_void(
  p_id          uuid,
  p_kedai_id    uuid,
  p_employee_id uuid,
  p_alasan      text
)
returns table (transaction_number text, total numeric, review_status text)
language plpgsql
as $$
declare
  v_tx      record;
  v_status  text;
begin
  select t.* into v_tx
  from transactions t
  where t.id = p_id and t.kedai_id = p_kedai_id;

  if not found then
    raise exception 'Transaksi tidak ditemukan di kedai ini'
      using errcode = 'no_data_found';
  end if;

  if v_tx.status = 'void' then
    raise exception 'Transaksi ini sudah dibatalkan.'
      using errcode = 'check_violation';
  end if;

  -- Idempoten: pengajuan ganda (retry form) tidak menulis baris kedua.
  if v_tx.status = 'perlu_review' then
    transaction_number := v_tx.transaction_number;
    total := v_tx.total;
    review_status := 'perlu_review';
    return next;
    return;
  end if;

  if char_length(btrim(coalesce(p_alasan, ''))) < 3 then
    raise exception 'Alasan wajib diisi (minimal 3 karakter)'
      using errcode = 'check_violation';
  end if;

  -- Sama seperti aturan void lama: hanya transaksi dari shift MASIH TERBUKA
  -- yang boleh diajukan kasir. Transaksi shift tertutup bukan domain kasir.
  select s.status into v_status from shifts s where s.id = v_tx.shift_id;
  if v_status <> 'open' then
    raise exception 'Transaksi ini dari shift yang sudah ditutup; tidak bisa diajukan untuk dibatalkan.'
      using errcode = 'check_violation';
  end if;

  update transactions
     set status = 'perlu_review'
   where id = p_id;

  insert into public.void_request (
    transaction_id, kedai_id, requested_by_employee_id, alasan
  ) values (
    p_id, p_kedai_id, p_employee_id, btrim(p_alasan)
  );

  transaction_number := v_tx.transaction_number;
  total := v_tx.total;
  review_status := 'perlu_review';
  return next;
end;
$$;

-- =====================================================================
-- 4. decide_void — keputusan pemilik: setujui (stok balik) / tolak.
--
-- Koperasi dengan void_transaction lama (M1-14) TANPA guard shift-terbuka:
-- transaksi dari shift yang sudah ditutup tetap harus bisa diputuskan
-- pemilik setelah ditutup. Disetujui -> status `void` + movement pembalik
-- (reason `void`) + saldo naik, semua 1 transaction. Ditolak -> `completed`.
-- `voided_by` diisi KARYAWAN yang mengajukan (yang keliru), bukan admin.
-- =====================================================================
create or replace function public.decide_void(
  p_request_id uuid,
  p_approve    boolean,
  p_decided_by uuid,
  p_note       text default null
)
returns table (transaction_number text, total numeric, review_status text)
language plpgsql
as $$
declare
  v_req    record;
  v_item   record;
  v_saldo  integer;
  v_tx     record;
begin
  -- for update: dua admin yang memutuskan bersamaan dihitung berurutan;
  -- yang kedua melihat status yang sudah berubah (penjaga idempotensi).
  select * into v_req
  from public.void_request
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Pengajuan void tidak ditemukan' using errcode = 'no_data_found';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'Keputusan untuk pengajuan ini sudah dibuat'
      using errcode = 'check_violation';
  end if;

  select t.* into v_tx
  from transactions t
  where t.id = v_req.transaction_id;

  if p_approve then
    -- Hanya transaksi yang masih `perlu_review` yang boleh di-void.
    update transactions
       set status    = 'void',
           voided_at = now(),
           voided_by = v_req.requested_by_employee_id
     where id = v_req.transaction_id
       and status = 'perlu_review';

    if not found then
      raise exception 'Transaksi tidak dalam status menunggu review'
        using errcode = 'check_violation';
    end if;

    -- Kembalikan stok, satu movement pembalik per item. Selalu lewat ledger,
    -- tidak pernah UPDATE kedai_stock sendirian.
    for v_item in
      select product_id, qty
      from transaction_items
      where transaction_id = v_req.transaction_id
    loop
      update kedai_stock
         set quantity = quantity + v_item.qty
       where kedai_id = v_req.kedai_id
         and product_id = v_item.product_id
      returning quantity into v_saldo;

      insert into stock_movements (
        kedai_id, product_id, delta, balance_after, reason,
        ref_transaction_id, created_by_admin_id, note
      ) values (
        v_req.kedai_id, v_item.product_id, v_item.qty, v_saldo, 'void',
        v_req.transaction_id, p_decided_by,
        'Void disetujui admin: ' || coalesce(nullif(btrim(p_note), ''), 'tanpa catatan')
      );
    end loop;

    review_status := 'approved';
  else

    if char_length(btrim(coalesce(p_note, ''))) < 1 then
      raise exception 'Alasan penolakan wajib diisi'
        using errcode = 'check_violation';
    end if;

    update transactions
       set status = 'completed'
     where id = v_req.transaction_id
       and status = 'perlu_review';

    if not found then
      raise exception 'Transaksi tidak dalam status menunggu review'
        using errcode = 'check_violation';
    end if;

    review_status := 'rejected';
  end if;

  update public.void_request
     set status     = review_status,
         decided_by = p_decided_by,
         decided_at = now(),
         note       = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_request_id;

  transaction_number := v_tx.transaction_number;
  total := v_tx.total;
  return next;
end;
$$;

revoke all on function public.request_void(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.decide_void(uuid, boolean, uuid, text)
  from public, anon, authenticated;

-- =====================================================================
-- 5. RLS void_request (pola sama dengan tabel lain: hanya session admin
--    resmi yang bisa akses lewat policy admin_all; anon & peran lain tidak).
-- =====================================================================
alter table public.void_request enable row level security;

create policy admin_all on public.void_request
  for all to authenticated
  using (true)
  with check (true);

-- =====================================================================
-- 6. M8-3: kas keluar terkait sesi.
--    expenses.shift_id  -> sesi mana uang itu keluar (kalau saat bekerja)
--    expenses.from_cash -> apakah diambil dari laci (mengurangi setoran)
--    RLS expenses sudah ada sejak 0002_rls.sql -- tidak diduplikasi.
-- =====================================================================
alter table public.expenses
  add column shift_id uuid references public.shifts (id) on delete restrict;
alter table public.expenses
  add column from_cash boolean not null default false;

create index expenses_shift_idx on public.expenses (shift_id);

comment on column public.expenses.shift_id is
  'Sesi (shift) tempat kas keluar terjadi. Diisi admin lewat form pengeluaran; kosong = pengeluaran umum tidak terikat sesi.';
comment on column public.expenses.from_cash is
  'True = uang DIAMBIL dari laci kasir; setoran seharusnya berkurang. False = dibayar di luar kas (tidak mengubah setoran).';

-- =====================================================================
-- 7. reconcile_shift: expected_cash = opening + tunai - kas keluar laci.
-- =====================================================================
create or replace function public.reconcile_shift(
  p_shift_id uuid,
  p_applied  integer default 0
)
returns table (
  expected_cash         numeric,
  cash_difference       numeric,
  reconciliation_status text,
  pending_sync_count    integer
)
language plpgsql
as $$
declare
  v_shift  record;
  v_tunai  numeric(12, 2);
  v_keluar numeric(12, 2);
  v_pending integer;
begin
  select * into v_shift from shifts where id = p_shift_id;
  if not found then
    raise exception 'Shift tidak ditemukan' using errcode = 'no_data_found';
  end if;

  -- Transaksi void / perlu_review TIDAK dihitung -- uangnya tidak (belum)
  -- di tangan kasir.
  select coalesce(sum(t.total), 0) into v_tunai
  from transactions t
  where t.shift_id = p_shift_id
    and t.payment_method = 'tunai'
    and t.status = 'completed';

  -- Kas keluar yang memang diambil dari laci mengurangi setoran seharusnya
  -- (M8-3): uang itu keluar bukan karena hilang, tapi karena dipakai.
  select coalesce(sum(e.amount), 0) into v_keluar
  from expenses e
  where e.shift_id = p_shift_id
    and e.from_cash;

  v_pending := greatest(v_shift.pending_sync_count - p_applied, 0);

  update shifts s
     set expected_cash   = s.opening_cash + v_tunai - v_keluar,
         cash_difference = case
                             when s.closing_cash is null then null
                             else s.closing_cash - (s.opening_cash + v_tunai - v_keluar)
                           end,
         pending_sync_count    = v_pending,
         reconciliation_status = case when v_pending = 0 then 'final' else 'pending_sync' end,
         reconciled_at         = now()
   where s.id = p_shift_id
  returning s.expected_cash, s.cash_difference, s.reconciliation_status, s.pending_sync_count
  into expected_cash, cash_difference, reconciliation_status, pending_sync_count;

  return next;
end;
$$;

commit;