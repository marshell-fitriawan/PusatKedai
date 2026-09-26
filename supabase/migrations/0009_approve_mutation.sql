-- =====================================================================
-- Persetujuan mutasi stok antar kedai (M4-4, M4-5)
--
-- SATU-SATUNYA cara admin mengizinkan perpindahan stok antar kedai.
-- Persetujuan dan EKSEKUSI terjadi dalam satu DB transaction: begitu
-- admin menekan "Setujui", stok pindah sekarang juga.
--
-- Yang pindah:
--   1. Kedai asal -qty, kedai tujuan +qty (dua update saldo)
--   2. Dua baris ledger: reason 'mutation_out' dan 'mutation_in'
--   3. status mutasi jadi 'approved' + executed_at (jejak eksekusi)
--
-- Idempotensi kalau dipanggil ulang dua kali dijaga DUa lapis:
--   - fungsi menolak mutasi yang bukan 'pending' lagi
--   - index unik parsial movements_once_per_mutation (ref_mutation_id,
--     reason) menolak baris ledger kedua
--
-- Tujuan yang belum punya baris stok (belum pernah diisi) ditangani
-- upsert, karena to_kedai_stock bisa saja belum ada.
-- =====================================================================

create or replace function public.approve_mutation(
  p_mutation_id uuid,
  p_admin_id    uuid
)
returns table (status text, from_quantity integer, to_quantity integer)
language plpgsql
as $$
declare
  m          stock_mutations%rowtype;
  v_from_qty integer;
  v_to_qty   integer;
begin
  -- Kunci baris mutasi terlebih dahulu: dua admin yang menyetujui
  -- bersamaan akan antre, dan yang kedua melihat status yang sudah
  -- berubah (bukan saling lihat 'pending').
  select * into m
  from stock_mutations
  where id = p_mutation_id
  for update;

  if not found then
    raise exception 'Mutasi tidak ditemukan'
      using errcode = 'P0001';
  end if;

  -- Idempoten: mutasi yang sudah pernah dieksekusi dipanggil ulang (mis.
  -- karena koneksi putus di tengah) cukup dikembalikan apa adanya.
  if m.status = 'approved' and m.executed_at is not null then
    status := m.status;

    select coalesce(ks.quantity, 0) into from_quantity
    from kedai_stock ks
    where ks.kedai_id = m.from_kedai_id and ks.product_id = m.product_id;

    select coalesce(ks.quantity, 0) into to_quantity
    from kedai_stock ks
    where ks.kedai_id = m.to_kedai_id and ks.product_id = m.product_id;

    return next;
    return;
  end if;

  if m.status <> 'pending' then
    raise exception 'Mutasi ini bukan pending (status %)', m.status
      using errcode = 'P0001';
  end if;

  -- Saldo dihitung SESUAT sebelum eksekusi, bukan saat pengajuan: stok
  -- bisa berubah di antara keduanya. Memindahkan stok yang tidak ada di
  -- kedai asal lebih buruk daripada ditolak di depan -- kasir kedai asal
  -- langsung tahu lewat pesan errornya.
  select ks.quantity into v_from_qty
  from kedai_stock ks
  where ks.kedai_id = m.from_kedai_id and ks.product_id = m.product_id
  for update;

  v_from_qty := coalesce(v_from_qty, 0);

  if v_from_qty < m.quantity then
    raise exception 'Stok kedai asal tidak mencukupi (tersedia %, diminta %)',
      v_from_qty, m.quantity
      using errcode = 'P0001';
  end if;

  select ks.quantity into v_to_qty
  from kedai_stock ks
  where ks.kedai_id = m.to_kedai_id and ks.product_id = m.product_id
  for update;

  v_to_qty := coalesce(v_to_qty, 0);

  -- Baris ledger asal: stok keluar.
  insert into stock_movements (
    kedai_id, product_id, delta, balance_after, reason,
    ref_mutation_id, created_by_admin_id, note
  ) values (
    m.from_kedai_id, m.product_id, -m.quantity, v_from_qty - m.quantity,
    'mutation_out', m.id, p_admin_id, 'Mutasi stok keluar'
  );

  -- Baris ledger tujuan: stok masuk.
  insert into stock_movements (
    kedai_id, product_id, delta, balance_after, reason,
    ref_mutation_id, created_by_admin_id, note
  ) values (
    m.to_kedai_id, m.product_id, m.quantity, v_to_qty + m.quantity,
    'mutation_in', m.id, p_admin_id, 'Mutasi stok masuk'
  );

  -- Saldo asal pasti ada (sudah diperiksa cukup di atas); update saldo
  -- mengurangi. Tujuan boleh belum punya baris -- upsert mengisinya.
  update kedai_stock
  set quantity = v_from_qty - m.quantity
  where kedai_id = m.from_kedai_id and product_id = m.product_id;

  insert into kedai_stock (kedai_id, product_id, quantity)
  values (m.to_kedai_id, m.product_id, v_to_qty + m.quantity)
  on conflict (kedai_id, product_id) do update
    set quantity = v_to_qty + m.quantity;

  update stock_mutations
  set status      = 'approved',
      approved_by = p_admin_id,
      approved_at = now(),
      executed_at = now()
  where id = m.id;

  status := 'approved';
  from_quantity := v_from_qty - m.quantity;
  to_quantity := v_to_qty + m.quantity;
  return next;
end;
$$;

revoke all on function public.approve_mutation(uuid, uuid)
  from public, anon, authenticated;