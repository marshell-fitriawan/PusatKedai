-- =====================================================================
-- Tutup toko & rekonsiliasi kas (M3-8, M3-9)
--
-- MASALAH YANG DISELESAIKAN
-- `expected_cash` = kas awal + penjualan tunai. Tapi saat toko ditutup,
-- sebagian transaksi bisa masih mengantre di HP kasir dan belum sampai
-- server. Angka yang dihitung saat itu pasti kurang.
--
-- Memaksa kasir menunggu sampai antrian kosong bukan pilihan: internet
-- mati total adalah kejadian nyata, dan toko tetap harus bisa tutup.
--
-- SOLUSINYA
-- Shift ditutup dengan angka SEMENTARA dan ditandai `pending_sync`.
-- Perangkat melaporkan berapa transaksi yang masih tertahan, disimpan di
-- `pending_sync_count`. Setiap kali antrian masuk lewat endpoint sync,
-- angkanya dihitung ulang dan penghitung tertunda dikurangi. Begitu nol,
-- statusnya jadi `final` -- baru sejak itu selisih kas boleh dianggap sah.
--
-- Kenapa ini penting: selisih kas adalah tuduhan terhadap orang. Menyajikan
-- angka yang belum lengkap sebagai final berarti menuduh kasir menghilangkan
-- uang yang sebenarnya tercatat rapi di HP-nya.
-- =====================================================================

alter table shifts
  add column if not exists pending_sync_count integer not null default 0
    check (pending_sync_count >= 0);

comment on column shifts.pending_sync_count is
  'Jumlah transaksi yang masih di antrian perangkat saat shift ditutup. Dikurangi tiap antrian masuk; nol berarti kas boleh dianggap final.';

-- ---------------------------------------------------------------------
-- Hitung ulang kas sebuah shift dari transaksi yang SUDAH sampai server.
-- Dipanggil saat tutup toko dan setiap kali antrian offline masuk.
-- ---------------------------------------------------------------------
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
  v_shift   record;
  v_tunai   numeric(12, 2);
  v_pending integer;
begin
  select * into v_shift from shifts where id = p_shift_id;
  if not found then
    raise exception 'Shift tidak ditemukan' using errcode = 'no_data_found';
  end if;

  -- Transaksi void TIDAK dihitung -- uangnya sudah dikembalikan ke pelanggan.
  select coalesce(sum(t.total), 0) into v_tunai
  from transactions t
  where t.shift_id = p_shift_id
    and t.payment_method = 'tunai'
    and t.status = 'completed';

  v_pending := greatest(v_shift.pending_sync_count - p_applied, 0);

  update shifts s
     set expected_cash   = s.opening_cash + v_tunai,
         cash_difference = case
                             when s.closing_cash is null then null
                             else s.closing_cash - (s.opening_cash + v_tunai)
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

-- ---------------------------------------------------------------------
-- Tutup toko.
-- ---------------------------------------------------------------------
create or replace function public.close_shift(
  p_shift_id      uuid,
  p_kedai_id      uuid,
  p_employee_id   uuid,
  p_closing_cash  numeric,
  p_pending_count integer default 0
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
  v_shift record;
begin
  -- Filter kedai_id disengaja: satu kedai tidak boleh menutup shift kedai
  -- lain, bahkan kalau id shift-nya ditebak dengan benar.
  select * into v_shift
  from shifts
  where id = p_shift_id and kedai_id = p_kedai_id;

  if not found then
    raise exception 'Shift tidak ditemukan di kedai ini' using errcode = 'no_data_found';
  end if;

  -- Idempoten: tombol yang tertekan dua kali tidak boleh menimpa angka kas
  -- yang sudah dicatat.
  if v_shift.status = 'closed' then
    expected_cash         := v_shift.expected_cash;
    cash_difference       := v_shift.cash_difference;
    reconciliation_status := v_shift.reconciliation_status;
    pending_sync_count    := v_shift.pending_sync_count;
    return next;
    return;
  end if;

  update shifts
     set status             = 'closed',
         closed_at          = now(),
         closed_by          = p_employee_id,
         closing_cash       = p_closing_cash,
         pending_sync_count = greatest(p_pending_count, 0)
   where id = p_shift_id;

  return query select * from public.reconcile_shift(p_shift_id, 0);
end;
$$;

-- Sama seperti fungsi transaksi: tanpa pencabutan ini, siapa pun dengan anon
-- key bisa menutup toko orang lain atau mengubah angka kasnya.
revoke all on function public.close_shift(uuid, uuid, uuid, numeric, integer)
  from public, anon, authenticated;
revoke all on function public.reconcile_shift(uuid, integer)
  from public, anon, authenticated;
