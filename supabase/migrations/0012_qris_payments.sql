-- =====================================================================
-- Pembayaran QRIS via Midtrans (M1-10, M1-11)
--
-- ALUR SINGKAT
--   1. Kasir memilih "Bayar QRIS" -> server menyimpan baris qris_payments
--      berstatus 'created' (snapshot items, shift, karyawan, kedai),
--      lalu meminta Midtrans charge (payment_type qris).
--   2. Pelanggan memindai QR. Konfirmasi bisa datang lewat DUA jalur yang
--      sah dan boleh tumpang tindih:
--        a. webhook Midtrans (cepat, andal)
--        b. polling yang dilakukan kasir (cadangan, kalau webhook telat)
--      Keduanya PADA AKHIRNYA memanggil fungsi yang sama:
--      confirm_qris_payment().
--   3. confirm_qris_payment() mencatat TRANSAKSI sungguhan (create_transaction
--      dengan payment_method='qris', id transaksi = id pembayaran) dalam
--      SATU transaction -- atau mengembalikan hasil yang sudah ada kalau
--      sudah pernah dipanggil (idempoten, lihat catatan di 0004_*).
--
-- KENAPA TRANSAKSI DICATAT TERLAMBAT (SAAT BAYAR), BUKAN SAAT CHARGE
--   create_transaction mengurangi stok dan mencatat ledger. Mengurangi stok
--   saat QR baru ditampilkan sama saja mengunci barang untuk pembayaran yang
--   belum tentu selesai. Stok baru berkurang saat pembayaran dikonfirmasi.
--
-- KENAPA ID TRANSAKSI = ID PEMBAYARAN
--   Jadi confirm_qris_payment() tidak perlu berpikir dua kali: pembayaran
--   yang 'paid' pasti punya transaksi dengan id yang sama, dan pemanggilan
--   dua jalur (webhook + polling) tidak mungkin membuat duplikat.
--
-- QRIS TIDAK MENGUBAH KAS TUNCAI
--   Rekonsiliasi shift (0006) hanya menghitung payment_method='tunai'.
--   Pembayaran QRIS yang dikonfirmasi setelah shift ditutup tetap menempel
--   ke shift itu tanpa mengubah angka uang tunai di catatan.
-- =====================================================================

create table qris_payments (
  -- id = id calon transaksi (lihat catatan "KENAPA ID TRANSAKSI").
  id                 uuid primary key,
  kedai_id           uuid        not null references kedai (id) on delete restrict,
  shift_id           uuid        not null references shifts (id) on delete restrict,
  employee_id        uuid        not null references employees (id) on delete restrict,
  local_number       text        not null,
  device_id          text        not null,

  -- Snapshot item + total, dihitung ULANG server pada saat charge (client
  -- tidak boleh menentukan total). Bentuknya sama dengan items create_transaction.
  items              jsonb       not null,
  total              numeric(12, 2) not null check (total > 0),

  -- order id Midtrans: "POS-<uuid pembayaran>" -- unik, dan cukup untuk
  -- mencari kembali pembayaran dari webhook maupun status API.
  midtrans_order_id  text        not null unique,

  status             text        not null default 'created'
                     check (status in ('created', 'paid', 'expired', 'failed')),

  -- QR bisa berupa string EMVCo (dirender perangkat) ATAU gambar dari
  -- Midtrans -- keduanya disimpan agar klien punya pilihan.
  qr_content         text,
  qr_image_url       text,

  expires_at         timestamptz not null,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz,

  -- Diisi saat status jadi 'paid'. NULL sebelum itu.
  transaction_id     uuid        references transactions (id) on delete restrict,

  constraint qris_paid_complete check (
    status <> 'paid' or (paid_at is not null and transaction_id is not null)
  )
);

-- Satu transaksi paling banyak ditagari satu pembayaran.
create unique index qris_transaction_unique
  on qris_payments (transaction_id)
  where transaction_id is not null;

-- Kasir mem-poller pembayaran yang masih menunggu; index ini yang dipakai.
create index qris_status_created_idx on qris_payments (status, created_at desc);

-- ---------------------------------------------------------------------
-- Baris pembayaran tidak pernah dirender lewat PostgREST: semua akses dari
-- server (charge, polling, webhook) memakai service role. RLS tetap
-- diaktifkan + permission anon/authenticated dicabut, supaya andai key anon
-- bocor ke browser tetap tidak ada jalur membaca/menulis data pembayaran.
-- ---------------------------------------------------------------------
alter table qris_payments enable row level security;
revoke all on table qris_payments from public, anon, authenticated;
grant all on table qris_payments to service_role;

-- =====================================================================
-- confirm_qris_payment(p_payment_id, p_paid_at)
--
-- SATU-SATUNYA tempat "pembayaran QRIS menjadi transaksi". Dipanggil dari
-- webhook dan polling; dijamin aman dipanggil dua kali:
--   * belum pernah diproses -> create_transaction (...) lalu status jadi 'paid'
--   * sudah 'paid'           -> mengembalikan transaksi yang sudah ada (idempoten)
--   * selain 'created'/'paid' -> error (pembayaran batal/kedaluwarsa)
--
-- p_paid_at diambil dari waktu yang dilaporkan Midtrans (webhook) atau saat
-- polling berhasil; menjadi created_at transaksi (business_date dihitung
-- dari zona waktu kedai, bukan server).
-- =====================================================================
create or replace function public.confirm_qris_payment(
  p_payment_id uuid,
  p_paid_at    timestamptz
)
returns table (transaction_number text, total numeric)
language plpgsql
as $$
declare
  v_payment qris_payments%rowtype;
  v_number  text;
  v_total   numeric;
begin
  -- Kunci baris sampai akhir transaction: webhook dan polling yang tiba
  -- bersamaan di-SERIAL-kan, yang kedua menunggu yang pertama selesai.
  select * into v_payment
  from qris_payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Pembayaran QRIS tidak dikenal' using errcode = 'qris_unknown';
  end if;

  -- Idempoten: sudah dibayar -> kembalikan transaksi yang sudah ada.
  if v_payment.status = 'paid' then
    select t.transaction_number, t.total
      into v_number, v_total
    from transactions t
    where t.id = p_payment_id;

    transaction_number := v_number;
    total             := v_total;
    return next;
    return;
  end if;

  if v_payment.status <> 'created' then
    raise exception 'Pembayaran QRIS sudah tidak aktif (status %)', v_payment.status
      using errcode = 'qris_state';
  end if;

  -- Skema apapun, total transaksi dihitung ULANG create_transaction dari
  -- items snapshot -- pelindung yang sama seperti transaksi tunai.
  select t.transaction_number, t.total
    into v_number, v_total
  from create_transaction(
    p_payment_id,
    v_payment.kedai_id,
    v_payment.shift_id,
    v_payment.employee_id,
    v_payment.local_number,
    v_payment.device_id,
    'qris',
    p_paid_at,
    v_payment.items
  ) t;

  update qris_payments
     set status = 'paid',
         paid_at = p_paid_at,
         transaction_id = p_payment_id
   where id = p_payment_id;

  transaction_number := v_number;
  total             := v_total;
  return next;
end;
$$;

-- Sama seperti fungsi lain yang memakai service role: tidak boleh dipanggil
-- lewat PostgREST dengan anon/authenticated.
revoke all on function public.confirm_qris_payment(uuid, timestamptz)
  from public, anon, authenticated;