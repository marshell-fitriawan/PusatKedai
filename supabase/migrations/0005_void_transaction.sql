-- =====================================================================
-- Fungsi pembatalan transaksi (M1-14, melengkapi M4-2)
--
-- Membatalkan = menandai `void` + menulis movement PEMBALIK, bukan DELETE.
-- Alasannya sama dengan ledger stok: laporan omzet harus bisa direkonstruksi
-- kapan saja, dan data yang sudah dihapus tidak bisa diaudit. Transaksi yang
-- salah tetap tercatat, beserta fakta bahwa ia dibatalkan, oleh siapa, kapan.
--
-- ATURAN: hanya transaksi di shift yang MASIH TERBUKA yang boleh dibatalkan
-- kasir. Membatalkan transaksi dari shift yang sudah ditutup akan mengubah
-- `expected_cash` shift itu secara surut -- selisih kas yang sudah
-- ditandatangani jadi tidak cocok lagi, dan tidak ada yang tahu kenapa.
-- Koreksi setelah tutup harus lewat admin (task terpisah).
-- =====================================================================

create or replace function public.void_transaction(
  p_id          uuid,
  p_kedai_id    uuid,
  p_employee_id uuid
)
returns table (transaction_number text, total numeric)
language plpgsql
as $$
declare
  v_tx     record;
  v_item   record;
  v_saldo  integer;
  v_status text;
begin
  select t.* into v_tx
  from transactions t
  where t.id = p_id and t.kedai_id = p_kedai_id;

  if not found then
    -- Filter kedai_id disengaja: satu kedai tidak boleh membatalkan
    -- transaksi kedai lain, bahkan kalau id-nya ditebak dengan benar.
    raise exception 'Transaksi tidak ditemukan di kedai ini'
      using errcode = 'no_data_found';
  end if;

  -- Idempoten: sudah void = selesai, bukan error. Tombol yang tertekan dua
  -- kali tidak boleh mengembalikan stok dua kali.
  if v_tx.status = 'void' then
    transaction_number := v_tx.transaction_number;
    total := v_tx.total;
    return next;
    return;
  end if;

  select s.status into v_status from shifts s where s.id = v_tx.shift_id;

  if v_status <> 'open' then
    raise exception 'Transaksi ini dari shift yang sudah ditutup. Pembatalan harus lewat admin.'
      using errcode = 'check_violation';
  end if;

  update transactions
     set status    = 'void',
         voided_at = now(),
         voided_by = p_employee_id
   where id = p_id;

  -- Kembalikan stok, satu movement pembalik per item.
  -- Unique index movements_once_per_transaction memakai kunci
  -- (ref_transaction_id, product_id, reason) -- baris 'void' tidak
  -- bertabrakan dengan baris 'sale' yang sudah ada, tapi pemanggilan kedua
  -- dengan reason yang sama akan ditolak database.
  for v_item in
    select product_id, qty from transaction_items where transaction_id = p_id
  loop
    update kedai_stock
       set quantity = quantity + v_item.qty
     where kedai_id = p_kedai_id and product_id = v_item.product_id
    returning quantity into v_saldo;

    insert into stock_movements (
      kedai_id, product_id, delta, balance_after, reason,
      ref_transaction_id, created_by_employee_id, note
    ) values (
      p_kedai_id, v_item.product_id, v_item.qty, v_saldo, 'void',
      p_id, p_employee_id,
      'Pembalikan transaksi ' || coalesce(v_tx.transaction_number, v_tx.local_number)
    );
  end loop;

  transaction_number := v_tx.transaction_number;
  total := v_tx.total;
  return next;
end;
$$;

-- Sama seperti create_transaction: tanpa pencabutan ini, siapa pun dengan
-- anon key bisa membatalkan transaksi orang lain lewat endpoint RPC.
revoke all on function public.void_transaction(uuid, uuid, uuid)
  from public, anon, authenticated;
