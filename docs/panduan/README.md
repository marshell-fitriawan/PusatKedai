# Panduan Developer

Dokumen di folder ini ditulis untuk **developer yang baru masuk ke proyek ini**. Bukan ringkasan teknis, tapi penjelasan: apa yang dibangun, kenapa dibangun seperti itu, cara menjalankannya, dan apa yang harus dicek kalau error.

Kalau kamu baru pertama kali membuka repo ini, **baca 00 sampai habis** sebelum menyentuh kode. Sisanya boleh dibaca saat dibutuhkan.

## Daftar Panduan

| No | Dokumen | Isi |
|---|---|---|
| **00** | [**Dokumentasi Induk (5W1H)**](00-5w1h.md) | **Mulai dari sini.** Kenapa produk ini ada, fitur apa dipilih & apa ditolak, siapa penggunanya, kapan tiap fase dikerjakan, dan kode intinya |
| 01 | [Fondasi Proyek](01-fondasi.md) | Setup, struktur folder, design token, komponen UI, PWA |
| 02 | [Database](02-database.md) | Skema, migration, seed, uji constraint, generate tipe |
| 03 | [Auth & Keamanan](03-auth-dan-keamanan.md) | Login admin, middleware, RLS, tiga client Supabase |
| 04 | [Layout & Navigasi](04-layout-dan-navigasi.md) | Layout admin, layout POS, rute |
| 05 | [CRUD Master Data](05-crud-master-data.md) | Kedai & produk, unggah gambar ke Storage |
| 06 | [Kasir & Transaksi](06-kasir-dan-transaksi.md) | Sesi QR, buka toko, keranjang, simpan transaksi, riwayat, void |

Dokumen 00 memakai kerangka **5W1H** (What, Why, Who, Where, When, How). Bagian **Why** yang paling penting — di situ tercatat kenapa keputusan-keputusan diambil, termasuk hal yang kelihatan seperti bug padahal disengaja (stok boleh minus, transaksi tidak pernah dihapus, service worker tidak menyimpan data API).

## Rencana Dokumen Berikutnya

Aturannya: **satu dokumen per kelompok fitur, bukan per task.** Dokumen ditulis setelah seluruh kelompoknya selesai — bukan setelah tiap task, supaya tidak ada dokumen pendek yang saling merujuk.

| No | Dokumen | Mencakup task | Status |
|---|---|---|---|
| 05 | [CRUD Master Data](05-crud-master-data.md) | M1-3 kedai, M1-4 produk | ✅ selesai |
| 06 | [Kasir & Transaksi](06-kasir-dan-transaksi.md) | M1-6, M1-7, M1-8, M1-9, M1-12, M1-13, M1-14 + M3-4, M3-6 | ✅ selesai |
| 07 | Pembayaran QRIS | M1-10 charge, M1-11 webhook | Belum |
| 08 | Offline-First | Seluruh M2 | Belum |
| 09 | [Karyawan, Shift & Absensi](09-karyawan-shift-absensi.md) | M3-1, M3-2, M3-5, M3-10 (M3-4, M3-6 di 06) | ✅ selesai |
| 10 | [Stok & Mutasi Antar Kedai](10-stok-dan-mutasi.md) | M4-1, M4-2/2b/2c, M4-3, M4-4, M4-5, M4-6 | ✅ selesai |
| 11 | [Laporan & Pengeluaran](11-laporan-dan-pengeluaran.md) | Seluruh M5 | ✅ selesai |
| 12 | Rilis & Operasional | Seluruh M6 | Belum |

Setiap kali satu kelompok selesai, perbarui juga **dokumen 00**: tabel status di bagian WHEN dan daftar "yang belum dibangun" di bagian HOW. Dua bagian itu yang paling cepat basi.

## Beda Folder `docs/` dan `docs/panduan/`

| | Isi | Pembaca |
|---|---|---|
| `docs/*.md` | Keputusan produk & rancangan (`idea`, `Tech`, `Database`, `design_1`, `Milestone`, `Tasks`) | Yang mau tahu **apa yang diputuskan dan kenapa** |
| `docs/panduan/*.md` | Cara kerja kode yang sudah jadi | Yang mau **mulai coding hari ini** |

Kalau keduanya bertentangan, `docs/Database.md` dan `docs/design_1.md` yang menang — itu sumber kebenaran rancangan. Laporkan ketidakcocokannya supaya diperbaiki.

## Aturan Menulis Panduan Baru

Setiap fase (milestone) atau fitur yang selesai **wajib** punya dokumen di sini. Format yang dipakai:

```markdown
# NN — Judul Fase

## Apa Ini
Satu paragraf: fitur ini menyelesaikan masalah apa.

## Kenapa Dibangun Begini
Keputusan penting dan alasannya. Bagian paling berharga --
tanpa ini orang berikutnya akan mengubah kode tanpa tahu
apa yang dia rusak.

## Isi Kode
File apa saja, tanggung jawab masing-masing.

## Cara Menjalankan / Menguji
Perintah yang bisa langsung di-copy.

## Kalau Error
Gejala -> penyebab -> solusi.

## Istilah
Kata teknis yang dipakai di dokumen ini, dijelaskan singkat.
```

Aturan menulisnya:

1. **Jelaskan "kenapa", bukan cuma "apa".** Kode sudah menjelaskan "apa".
2. **Definisikan istilah asing.** RLS, idempotensi, ledger, offline-first — jangan diasumsikan sudah paham.
3. **Perintah harus bisa di-copy-paste** dan benar-benar jalan.
4. **Sertakan bagian "kalau error"** dari masalah yang benar-benar pernah terjadi, bukan yang dibayangkan.
5. **Jangan mengandalkan konteks percakapan.** Tulis seolah pembaca baru clone repo ini pagi tadi.
