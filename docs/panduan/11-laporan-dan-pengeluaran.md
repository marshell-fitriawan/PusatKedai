# 11 — Laporan & Pengeluaran

Mencakup **M5-1** (pencatatan pengeluaran), **M5-2** (fungsi agregasi omzet di database), **M5-3** (dashboard), **M5-4** (perbandingan antar kedai), **M5-5** (stok konsolidasi), **M5-6** (untung-rugi kasar), **M5-7** (export CSV).

## Apa Ini

Owner menjalankan beberapa kedai. Setiap kedai bisa lapor omzetnya sendiri lewat POS, tapi tidak ada satupun yang melihat **semua kedai sekaligus**. Milestone ini menutup itu: satu dashboard yang menjumlahkan omzet, membandingkan kedai berdampingan, memadukan stok, dan — dengan pencatatan pengeluaran — memberi gambaran untung-rugi kasar.

Dua tipe halaman:

- **Analisis** (`/admin/dashboard`, `/admin/dashboard/perbandingan`): omzet, tren, porsi.
- **Laporan** (`/admin/pengeluaran`, `/admin/laporan/stok`, `/admin/laporan/laba-rugi`): data yang bisa diperiksa & diunduh.

## Kenapa Dibangun Begini

### 1. Agregasi di database, bukan di TypeScript

Omzet dikumpulkan lewat fungsi Postgres `report_omzet` dan `report_laba_rugi` (migration 0010), bukan dengan menarik ribuan baris transaksi lalu menjumlahkannya di server. Alasan:

- **Angka tidak bisa dihitung dua kali di tempat berbeda.** Kalau setiap halaman menjumlahkan sendiri-sendiri dengan logika masing-masing, selisih kecil diam-diam muncul (transaksi void yang ikut terhitung misalnya). Satu fungsi = satu definisi "omzet".
- `report_laba_rugi` memakai `left join` dari `kedai` — **kedai tanpa transaksi tetap muncul** dengan omzet 0 (gudang pusat dikecualikan, lihat §7). Halaman yang menampilkan per-kedai kehilangan baris tanpa ini.
- Fungsi juga menyatakan "omzet = `sum(total)` di mana `status = 'completed'`" **hanya di satu tempat**. Void sudah dikecualikan; kalau nanti aturan omzet berubah, cukup ubah satu fungsi.

Keputusan per bucket tanggal: `case` di dalam fungsi — `harian` pakai `business_date` polos, `mingguan` pakai `date_trunc('week', ...)`, `bulanan` pakai `date_trunc('month', ...)`. Tipe kembalian semua bucket adalah `date`, jadi satu struktur (CLI pakai `tanggal, kedai_id, omzet, jumlah_transaksi`) untuk ketiga granularitas.

### 2. Hak akses fungsi laporan (migration 0011)

Migration 0010 semula mencabut izin dari `public`, `anon`, **dan** `authenticated` — pola aman dari dokumen 06. Ternyata itu salah untuk laporan: server action tidak dipakai di sini, dashboard memanggil RPC **langsung dengan anon key + JWT sesi admin**, yang masuk sebagai role `authenticated`. Mencabut `authenticated` ikut mematikan halaman yang sah.

Migration 0011 memperbaiki: revoke dari `public` dan `anon` saja, lalu **grant ke `authenticated`**. `anon` (pengunjung tanpa login) tetap tidak bisa memanggilnya; admin yang sudah login bisa. Ini adalah satu-satunya tempat di proyek ini yang memakai klien server biasa untuk RPC dengan data sensitif — dan aman karena halamannya sudah digerbang `requireAdmin()` di layout.

### 3. Pencatatan pengeluaran

- Kategori **daftar tetap** (`bahan_baku`, `listrik`, `sewa`, `gaji`, `lainnya`) — constraint CHECK di migration 0010 dan diduplikasi di Zod supaya kasir mendapat pesan ramah, bukan error DB.
- Pencatat diambil **dari sesi admin** (`recorded_by_admin_id`), bukan dari form — pola yang sama dengan pencatat stok dan mutasi.
- **Pengeluaran boleh dihapus.** Ini sengaja berbeda dari transaksi dan ledger stok: pengeluaran tidak menyentuh ledger apa pun, jadi menghapusnya tidak merusak jejak audit. Kesalahan input cukup dihapus.

### 4. Laba "kasar", dengan sadar

`report_laba_rugi` menghitung `omzet − pengeluaran`. Itu **bukan** laba bersih: tidak ada nilai persediaan, penyusutan, atau pajak. Halaman menampilkan peringatan itu secara eksplisit — karena kesalahan terbesar halaman laporan adalah menyiratkan akurasi yang tidak dimiliki datanya.

### 5. Chart CSS murni, tanpa library

Tidak ada dependency chart. `components/admin/trend-chart.tsx` membuat bar chart dengan flex + `<div>` — tinggi plot ditetapkan (`h-40 md:h-56`) supaya `height: %` punya basis yang pasti, nilai presisi ada di tooltip native `title`, dan selalu menyertakan teks/figure yang bisa dibaca screen reader. Untuk MVP dengan ≤ 5 kedai, chart library adalah bobot yang tidak perlu.

### 6. Export CSV tanpa library

`lib/export/csv.ts` menulis CSV dengan tangan: separator `;` (Excel Indonesia membuka `;` sebagai delimiter default), BOM UTF-8 di depan (agar Excel tidak salah baca karakter), nilai berisi separator/kutip dibungkus kutip dengan escape ganda (RFC 4180), angka dikirim **mentah** supaya spreadsheet bisa menjumlahkannya. `ExportCsvButton` membuat Blob dan memicu download sepenuhnya di browser.

### 7. Gudang pusat bukan gerai penjualan (migration 0020)

Gudang pusat adalah `kedai` dengan `is_warehouse = true`: tidak punya karyawan, tidak buka sesi, tidak menerima transaksi kasir (lihat `docs/Database.md` §`kedai`). Karena `report_harian` dan `report_laba_rugi` sengaja memakai `from kedai` agar kedai tanpa transaksi tetap muncul, gudang ikut tampil sebagai baris omzet 0 — derau yang menyesatkan pemilik. Migration 0020 menambahkan filter:

- `report_harian` — gudang **selalu** dikecualikan.
- `report_laba_rugi` — gudang dikecualikan, **kecuali** ia punya `expenses` pada rentang tersebut; kalau ada, barisnya tetap tampil supaya biaya itu tidak hilang diam-diam dari total.
- Dashboard, Perbandingan, dan Laba-Rugi juga menyaring `is_warehouse = false` di sisi halaman (mereka meng-enumerasi `kedai` sendiri untuk kartu/tabel).
- **Laporan Stok tidak diubah**: gudang memang menyimpan stok jadi & bahan mentah, jadi kolom gudang tetap relevan.

## Isi Kode

```
supabase/migrations/0010_report.sql        report_omzet(), report_laba_rugi(), tabel expenses
supabase/migrations/0011_report_grants.sql grant authenticated / revoke public+anon
supabase/migrations/0020_report_exclude_warehouse.sql  report_harian & report_laba_rugi tanpa gudang
supabase/tests/laporan.sql                 14 uji agregasi & hak akses
app/admin/(dashboard)/pengeluaran/*        catat & hapus pengeluaran
app/admin/(dashboard)/dashboard/page.tsx   kartu ringkasan + tren + porsi per kedai
app/admin/(dashboard)/dashboard/perbandingan/page.tsx   tabel side-by-side + grouped bars
app/admin/(dashboard)/laporan/page.tsx     hub: stok & laba-rugi
app/admin/(dashboard)/laporan/stok/page.tsx    konsolidasi stok semua kedai
app/admin/(dashboard)/laporan/laba-rugi/page.tsx  omzet − pengeluaran per kedai
components/admin/trend-chart.tsx           TrendChart, GroupedBars (CSS murni)
components/admin/export-csv-button.tsx     tombol unduh CSV
lib/export/csv.ts                          serialisasi CSV (RFC 4180 + ; + BOM)
```

## Cara Menguji

```bash
npm run db -- supabase/tests/laporan.sql    # 14/14: agregasi, void, kosong, gudang, grants
npm run lint
npm run build
```

Uji manual (login owner `owner@kedaidev.test` / `dev-owner-2026`):

1. `/admin/pengeluaran` → "Catat Biaya" → pilih kedai, kategori, deskripsi, jumlah, tanggal → Simpan. Baris muncul dengan total filter yang ter-update. Tombol hapus bekerja lewat modal konfirmasi.
2. `/admin/dashboard` → ganti "Tampilan" ke Mingguan/Bulanan, geser rentang tanggal → kartu & tren mengikuti tanpa reload penuh (form GET).
3. `/admin/dashboard/perbandingan` → tabel side-by-side, badge pertumbuhan ↗/↘, grouped bars dengan legend.
4. `/admin/laporan/laba-rugi` → "Unduh CSV" → buka di Excel: kolom terpisah rapi, angka bisa dijumlahkan.
5. `/admin/laporan/stok` → cek badge habis/menipis dan cell berwarna di bawah threshold.
6. Audit kebenaran omzet di dashboard vs penjumlahan manual `select sum(total) from transactions where status='completed'`.

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| RPC `report_omzet` error "permission denied" | Fungsi belum di-grant ke `authenticated` (atau dipanggil tanpa login) | Jalankan migration 0011; pastikan masuk admin dulu |
| Dashboard kosong walau ada transaksi | Rentang tanggal berdiri sendiri (`dari` di atas `sampai`) memberikan hasil kosong yang valid | Perbesar rentang; fungsi tidak melempar error untuk rentang terbalik |
| Chart tingginya nol / bar tidak muncul | `TrendChart` dipakai tanpa tinggi plot | Pastikan data masuk ke komponen dengan `data` bukan array kosong (diganti teks kosong), dan jangan menimpa `h-40 md:h-56` |
| CSV terbuka 1 kolom di Excel | Terbuka dengan separator koma di sistem locale bukan Indonesia | File memakai `;`; buka via Data → From Text/CSV dan pilih delimiter `;` |
| Angka omzet lebih tinggi dari ekspektasi | Transaksi lama/seed ikut terhitung karena berada di rentang | Uji pakai rentang tanggal yang ketat; fungsi laporan tidak tahu rentang "realistis", terserah UI |

## Istilah

- **Agregasi** — penjumlahan banyak baris menjadi satu angka (omzet per hari/kedai).
- **Bucket** — wadah waktu (hari/minggu/bulan) tempat data diakumulasi.
- **Laba-rugi kasar** — omzet dikurangi pengeluaran tercatat, *tanpa* persediaan/penyusutan/pajak.
- **Granularitas** — ukuran bucket: harian, mingguan, atau bulanan.
- **BOM** — Byte Order Mark, prefix `\uFEFF` di awal file agar Excel mendeteksi UTF-8.
- **RFC 4180** — aturan cara menulis CSV agar bisa dibuka program spreadsheet mana pun.