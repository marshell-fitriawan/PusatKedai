-- =====================================================================
-- Fungsi simpan transaksi (M1-8, M1-9, sebagian M4-2)
--
-- KENAPA SATU FUNGSI, BUKAN BEBERAPA QUERY DARI APLIKASI
--
-- Satu penjualan menyentuh empat hal yang harus berhasil atau gagal
-- BERSAMA-SAMA:
--   1. baris transactions (+ nomor urut final)
--   2. baris transaction_items
--   3. saldo kedai_stock
--   4. baris stock_movements (ledger)
--
-- Kalau dikerjakan sebagai query terpisah dari Next, kegagalan jaringan di
-- tengah meninggalkan transaksi tanpa item, atau stok berkurang tanpa
-- penjualan. Di sistem kasir itu berarti uang dan barang tidak cocok, dan
-- tidak ada cara memperbaikinya selain menebak.
--
-- IDEMPOTEN: dipanggil ulang dengan p_id yang sama tidak menghasilkan apa
-- pun yang baru -- ia mengembalikan nomor yang sudah ada. Ini wajib untuk
-- antrian offline di M2, karena pengiriman ulang tidak bisa dihindari.
-- =====================================================================

create or replace function public.create_transaction(
  p_id             uuid,
  p_kedai_id       uuid,
  p_shift_id       uuid,
  p_employee_id    uuid,
  p_local_number   text,
  p_device_id      text,
  p_payment_method text,
  p_created_at     timestamptz,
  p_items          jsonb
)
returns table (transaction_number text, business_date date, total numeric)
language plpgsql
as $$
declare
  v_tz            text;
  v_business_date date;
  v_next          integer;
  v_number        text;
  v_total         numeric(12, 2) := 0;
  v_item          jsonb;
  v_saldo         integer;
begin
  -- ---------------------------------------------------------------
  -- 1. Idempotensi: sudah pernah disimpan?
  -- ---------------------------------------------------------------
  select t.transaction_number, t.business_date, t.total
    into transaction_number, business_date, total
  from transactions t
  where t.id = p_id;

  if found then
    -- Bukan error. Antrian offline memang mengirim ulang; yang penting
    -- hasilnya tetap satu transaksi dengan nomor yang sama.
    return next;
    return;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Transaksi tanpa item' using errcode = 'check_violation';
  end if;

  -- ---------------------------------------------------------------
  -- 2. Hari operasional menurut zona waktu KEDAI, bukan server
  -- ---------------------------------------------------------------
  select k.timezone into v_tz from kedai k where k.id = p_kedai_id;
  if v_tz is null then
    raise exception 'Kedai tidak ditemukan: %', p_kedai_id;
  end if;

  v_business_date := (p_created_at at time zone v_tz)::date;

  -- ---------------------------------------------------------------
  -- 3. Nomor urut final, per kedai per hari
  --
  -- Advisory lock menyerialkan penomoran untuk kombinasi kedai+tanggal
  -- ini saja. Tanpa itu, dua transaksi yang tiba bersamaan sama-sama
  -- membaca nomor tertinggi yang sama lalu bertabrakan di unique index.
  -- Lock dilepas otomatis saat transaksi selesai.
  -- ---------------------------------------------------------------
  perform pg_advisory_xact_lock(hashtext(p_kedai_id::text || v_business_date::text));

  select coalesce(max(t.transaction_number::integer), 0) + 1
    into v_next
  from transactions t
  where t.kedai_id = p_kedai_id
    and t.business_date = v_business_date
    and t.transaction_number ~ '^[0-9]+$';

  v_number := v_next::text;

  -- ---------------------------------------------------------------
  -- 4. Total dihitung ULANG di server dari harga yang dikirim client.
  --
  -- Client boleh menentukan harga (itu snapshot saat barang masuk
  -- keranjang, dan pelanggan sudah diberi tahu angkanya), tapi TIDAK
  -- boleh menentukan totalnya -- kalau tidak, perangkat yang dimodifikasi
  -- bisa melaporkan total nol untuk sepuluh item.
  -- ---------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_total := v_total
      + (v_item->>'price')::numeric * (v_item->>'qty')::integer;
  end loop;

  -- ---------------------------------------------------------------
  -- 5. Header transaksi
  -- ---------------------------------------------------------------
  insert into transactions (
    id, kedai_id, shift_id, employee_id, business_date,
    local_number, transaction_number, subtotal, total,
    payment_method, status, device_id, created_at
  ) values (
    p_id, p_kedai_id, p_shift_id, p_employee_id, v_business_date,
    p_local_number, v_number, v_total, v_total,
    p_payment_method, 'completed', p_device_id, p_created_at
  );

  -- ---------------------------------------------------------------
  -- 6. Item + stok + ledger
  -- ---------------------------------------------------------------
  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into transaction_items (
      id, transaction_id, product_id,
      product_name_snapshot, price_snapshot, qty, subtotal
    ) values (
      gen_random_uuid(), p_id, (v_item->>'product_id')::uuid,
      v_item->>'name',
      (v_item->>'price')::numeric,
      (v_item->>'qty')::integer,
      (v_item->>'price')::numeric * (v_item->>'qty')::integer
    );

    -- Saldo stok. Baris dibuat kalau belum ada -- produk baru yang belum
    -- pernah di-stok tetap boleh dijual, saldonya jadi negatif.
    -- Stok minus memang diizinkan (docs/Database.md §7).
    insert into kedai_stock (kedai_id, product_id, quantity)
    values (p_kedai_id, (v_item->>'product_id')::uuid, -(v_item->>'qty')::integer)
    on conflict (kedai_id, product_id) do update
      set quantity = kedai_stock.quantity - (v_item->>'qty')::integer
    returning quantity into v_saldo;

    -- Ledger. Unique index movements_once_per_transaction yang menjamin
    -- pengiriman ulang tidak mengurangi stok dua kali -- pengecekan di
    -- langkah 1 adalah lapis pertama, ini lapis terakhir.
    insert into stock_movements (
      kedai_id, product_id, delta, balance_after, reason,
      ref_transaction_id, created_by_employee_id
    ) values (
      p_kedai_id, (v_item->>'product_id')::uuid,
      -(v_item->>'qty')::integer, v_saldo, 'sale',
      p_id, p_employee_id
    );
  end loop;

  transaction_number := v_number;
  business_date      := v_business_date;
  total              := v_total;
  return next;
end;
$$;

-- ---------------------------------------------------------------------
-- PostgREST mengekspos setiap fungsi di schema public sebagai endpoint RPC.
-- Tanpa pencabutan ini, siapa pun yang punya anon key (dan anon key selalu
-- bocor -- ia dikirim ke browser) bisa membuat transaksi palsu.
--
-- Hanya service_role yang boleh memanggil, dan service_role hanya ada di
-- server.
-- ---------------------------------------------------------------------
revoke all on function public.create_transaction(
  uuid, uuid, uuid, uuid, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;
