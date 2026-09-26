-- =====================================================================
-- Penyesuaian stok manual (M4-1, M4-2b)
--
-- SATU-SATUNYA cara admin boleh mengubah stok. Tidak ada UPDATE langsung ke
-- kedai_stock di mana pun dalam aplikasi.
--
-- Kenapa harus lewat fungsi: saldo dan ledger wajib berubah bersama. Kalau
-- admin bisa meng-UPDATE saldo tanpa menulis movement, riwayat stok langsung
-- bolong -- dan saat stok fisik tidak cocok, tidak ada apa pun untuk
-- ditelusuri. Itu menghapus seluruh gunanya punya ledger.
--
-- `note` WAJIB diisi. Angka stok yang berubah tanpa alasan tertulis sama
-- saja dengan tidak ada catatan: enam bulan kemudian tidak ada yang ingat
-- kenapa stok kopi tiba-tiba turun 20.
-- =====================================================================

create or replace function public.adjust_stock(
  p_kedai_id     uuid,
  p_product_id   uuid,
  p_new_quantity integer,
  p_note         text,
  p_admin_id     uuid
)
returns table (quantity integer, delta integer, reason text)
language plpgsql
as $$
declare
  v_lama  integer;
  v_ada   boolean;
  v_delta integer;
  v_alasan text;
begin
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'Alasan penyesuaian wajib diisi'
      using errcode = 'check_violation';
  end if;

  select ks.quantity into v_lama
  from kedai_stock ks
  where ks.kedai_id = p_kedai_id and ks.product_id = p_product_id;

  v_ada := found;
  v_lama := coalesce(v_lama, 0);
  v_delta := p_new_quantity - v_lama;

  if v_delta = 0 then
    -- Tidak ada yang berubah. Menulis movement ber-delta nol dilarang
    -- constraint, dan memang tidak ada gunanya.
    quantity := v_lama;
    delta := 0;
    reason := 'tidak berubah';
    return next;
    return;
  end if;

  -- Pengisian stok pertama kali dicatat sebagai `initial`, perubahan
  -- berikutnya sebagai `adjustment`. Membedakannya memudahkan audit:
  -- `initial` adalah titik awal yang wajar, `adjustment` yang sering
  -- muncul justru sinyal ada masalah pencatatan atau kebocoran.
  v_alasan := case when v_ada then 'adjustment' else 'initial' end;

  insert into kedai_stock (kedai_id, product_id, quantity)
  values (p_kedai_id, p_product_id, p_new_quantity)
  on conflict (kedai_id, product_id) do update
    set quantity = p_new_quantity;

  insert into stock_movements (
    kedai_id, product_id, delta, balance_after, reason,
    created_by_admin_id, note
  ) values (
    p_kedai_id, p_product_id, v_delta, p_new_quantity, v_alasan,
    p_admin_id, p_note
  );

  quantity := p_new_quantity;
  delta := v_delta;
  reason := v_alasan;
  return next;
end;
$$;

revoke all on function public.adjust_stock(uuid, uuid, integer, text, uuid)
  from public, anon, authenticated;
