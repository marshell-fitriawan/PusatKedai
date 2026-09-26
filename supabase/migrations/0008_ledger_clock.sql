-- =====================================================================
-- Urutan ledger yang deterministik
--
-- MASALAH
-- `created_at` memakai default `now()`. Di Postgres, `now()` mengembalikan
-- waktu MULAI TRANSAKSI, bukan waktu baris ditulis. Semua baris yang lahir
-- di satu transaksi punya `created_at` yang persis sama.
--
-- Untuk ledger yang gunanya justru merekonstruksi urutan kejadian, itu
-- cacat: `order by created_at` tidak bisa menentukan mana yang lebih dulu,
-- dan riwayat bisa tampil terbalik. Saat menelusuri kenapa stok tidak
-- cocok, urutan yang salah menuntun ke kesimpulan yang salah.
--
-- `clock_timestamp()` mengembalikan waktu sungguhan saat baris ditulis,
-- sehingga baris-baris dalam satu transaksi tetap terurut.
--
-- Hanya diterapkan ke tabel ledger. `transactions.created_at` sengaja tidak
-- diubah -- kolom itu diisi PERANGKAT (waktu transaksi dibuat di HP), bukan
-- oleh default database.
-- =====================================================================

alter table stock_movements
  alter column created_at set default clock_timestamp();

comment on column stock_movements.created_at is
  'Waktu baris ditulis (clock_timestamp, bukan now()) supaya beberapa movement dalam satu transaksi tetap bisa diurutkan.';
