# Provisioning.md — Checklist Instance Klien Baru

Runbook untuk menyiapkan satu instance baru: **1 klien = 1 project Supabase + 1 project Vercel**.

Target waktu: di bawah 1 jam untuk orang yang belum pernah melakukannya, dengan mengikuti dokumen ini apa adanya.

> **Status dokumen:** langkah-langkah di bawah disusun dari konfigurasi repo yang sudah ada, tapi **belum pernah dijalankan end-to-end** sampai klien pilot pertama. Bagian yang belum terverifikasi ditandai 🔬. Perbarui dokumen ini begitu benar-benar dijalankan — termasuk waktu nyata yang dibutuhkan.

---

## 0. Sebelum mulai

Kumpulkan dulu dari klien:

- [ ] Nama bisnis (untuk `NEXT_PUBLIC_CLIENT_NAME` dan nama project)
- [ ] Daftar kedai awal: nama, alamat, telepon, timezone
- [ ] Daftar karyawan awal per kedai + perannya (`kasir` / `admin_kedai`)
- [ ] Email owner (untuk akun admin pertama)
- [ ] Katalog produk awal (nama, harga, kategori) — CSV lebih baik daripada foto menu
- [ ] Kredensial Midtrans klien (kalau QRIS dipakai) — **akun klien, bukan akun Anda**

Yang terakhir penting: uang masuk ke rekening klien, jadi akun Midtrans harus atas nama mereka.

---

## 1. Database (Supabase)

### 1.1 Buat project

- [ ] Buat project baru, nama: `multikedai-<slug-klien>`
- [ ] **Region: Singapore** (`ap-southeast-1`) untuk klien Indonesia — latensi terdekat
- [ ] Simpan database password di password manager, **bukan** di chat atau catatan

### 1.2 Naikkan ke paket berbayar sebelum dipakai klien

- [ ] Paket Pro (minimal) — **free tier tidak boleh dipakai klien**, project-nya di-*pause* saat tidak aktif
- [ ] Aktifkan **PITR (point-in-time recovery)**

Kenapa PITR wajib, bukan opsional: backup harian berarti kalau database rusak jam 5 sore, omzet sehari penuh hilang. Ini data uang milik orang lain.

> Detail paket dan harga berubah dari waktu ke waktu — **cek langsung halaman pricing Supabase**, jangan mengandalkan angka yang beredar di dokumen internal.

### 1.3 Jalankan migration

Isi `SUPABASE_DB_URL` di `.env.local` dengan connection string **Session pooler**, lalu:

```bash
npm run db -- -e "select version()"                # uji koneksi
npx supabase db push --db-url "$SUPABASE_DB_URL"   # apply migration
```

> **Jangan pakai Direct connection.** Host `db.<ref>.supabase.co` hanya punya record IPv6, dan dari koneksi tanpa rute IPv6 (umum di Indonesia) hasilnya `getaddrinfo ENOTFOUND` — pesan yang tidak mengarahkan ke akar masalahnya sama sekali. Pakai `aws-0-<region>.pooler.supabase.com:5432`, dan perhatikan usernya `postgres.<ref>`, bukan `postgres`.

> Kalau migration terlanjur dijalankan manual lewat SQL Editor, riwayat migration tidak tercatat dan push berikutnya akan gagal dengan "relation already exists". Perbaiki dengan:
> `npx supabase migration repair --status applied 0001 --db-url "$SUPABASE_DB_URL"`

- [ ] Migration `0001_init.sql` ter-apply tanpa error
- [ ] Cek drift: `npm run db -- supabase/tests/schema-check.sql` → **harus 0 baris**
- [ ] Uji constraint: `npm run db -- supabase/tests/constraints.sql` → **30/30 lulus**
- [ ] Uji RLS: `npm run db -- supabase/tests/rls.sql` → **4/4 lulus**
- [ ] Uji perilaku (transaksi, void, shift, kas keluar, stok, mutasi, laporan, QRIS): jalankan seluruh `supabase/tests/*.sql` → kolom `gagal` nol di semua file
- [ ] `npm run gen:types` supaya tipe TypeScript cocok dengan skema instance ini

Cek drift bukan formalitas: kalau skema pernah diterapkan manual dan ada bagian yang gagal di tengah, kolomnya bisa lengkap semua sementara constraint-nya diam-diam tertinggal — dan justru constraint itulah yang menjaga uang tidak bocor.

> **Jangan pernah menjalankan `npm run seed` atau `npm run seed:minggu` di instance produksi.** Seed melakukan TRUNCATE seluruh data operasional dan membuat akun admin/QR dev. Data awal diisi manual di langkah 1.4. (Fixture `supabase/tests/_fixtures.sql` hanya disisipkan oleh `npm run db` saat uji, ikut rollback, dan tidak menyentuh data produksi.)

### 1.4 Data awal

- [ ] Buat akun owner lewat Supabase Auth (email/password), lalu masukkan barisnya ke `admin_users` dengan `id` yang sama
- [ ] Input kedai, karyawan, produk, dan stok awal
- [ ] Stok awal wajib lewat `stock_movements` dengan `reason = 'initial'` — **jangan** UPDATE `kedai_stock` langsung, nanti ledger-nya bolong sejak hari pertama

---

## 2. Aplikasi (Vercel)

> Untuk langkah deploy-nya secara lengkap (termasuk prasyarat git, environment
> variable, dan smoke test), lihat **[deploy-vercel.md](deploy-vercel.md)**.
> Ringkasnya:

- [ ] Repo sudah punya minimal satu commit dan remote git — **deploy lewat git, bukan lewat CLI**
- [ ] Import repo, nama project: `multikedai-<slug-klien>`
- [ ] Region deployment: Singapore (`sin1`), sepadan dengan region Supabase
- [ ] Isi environment variables (lihat `.env.example`):

| Variable | Sumber | Catatan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Data API | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Data API | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Data API | **Server only.** Jangan pernah diprefix `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_CLIENT_NAME` | Nama bisnis klien | Tampil di UI |
| `MIDTRANS_SERVER_KEY` | Akun Midtrans klien | Wajib di production kalau QRIS dipakai — tanpa key, kode **menolak** QRIS (mode mock hanya untuk dev/demo). Klien Malaysia: QRIS out of scope, biarkan kosong |
| `MIDTRANS_ENV` | `production` | `sandbox` hanya untuk uji coba |

- [ ] Deploy dan pastikan build hijau
- [ ] **Build hijau bukan bukti env var benar.** `NEXT_PUBLIC_SUPABASE_URL` yang kosong tetap menghasilkan build sukses, hanya saja semua gambar produk jadi rusak. Ikuti smoke test di [deploy-vercel.md](deploy-vercel.md#langkah-6---smoke-test-setelah-deploy)
- [ ] Setel Supabase → Authentication → URL Configuration: Site URL + Redirect URL untuk domain klien
- [ ] Setel URL notifikasi Midtrans ke `https://<domain-klien>/api/midtrans/webhook` (kalau QRIS dipakai)
- [ ] Pasang domain (subdomain per klien, mis. `namaklien.domainanda.com`)
- [ ] Pastikan HTTPS aktif — **PWA dan akses kamera untuk scan QR tidak jalan tanpa HTTPS**
- [ ] Tutup checklist smoke test di deploy-vercel.md

> `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` dan `NEXT_PUBLIC_SENTRY_DSN` pernah ada di template `.env.example` tapi **tidak dipakai kode** (Sentry belum terpasang, task M9-3) — sudah dicabut supaya provisioning tidak mengarahkan ke pengaturan yang tidak berpengaruh.

---

## 3. Error tracking (Sentry — belum terpasang)

Sentry belum diimplementasikan (task M9-3) — tidak ada dependency maupun konfigurasi `sentry.*` di repo. Sampai terpasang, andalkan log deployment Vercel per instance. Setelah M9-3 selesai, lengkapi bagian ini:

- [ ] Buat project Sentry per klien (atau satu project dengan tag `client`)
- [ ] Pastikan `kedai_id` dan versi build ikut terkirim sebagai tag
- [ ] Picu satu error uji, pastikan muncul lengkap dengan konteksnya

---

## 4. Uji restore — jangan dilewati

**Backup yang belum pernah di-restore bukan backup.** Lakukan sekali sebelum klien mulai pakai:

- [ ] 🔬 Restore backup ke project Supabase kosong
- [ ] 🔬 Verifikasi jumlah baris transaksi cocok
- [ ] 🔬 Catat berapa lama prosesnya

Angka terakhir itu yang akan ditanya klien saat terjadi masalah ("berapa lama sampai pulih?"). Lebih baik Anda sudah tahu jawabannya sebelum ditanya.

---

## 5. Verifikasi sebelum serah terima

Jalankan di **HP fisik**, bukan emulator — ini alur kerja harian mereka:

- [ ] Install PWA ke home screen dari Chrome Android
- [ ] Scan QR karyawan → sesi kasir terbuka
- [ ] Buka toko dengan kas awal
- [ ] Transaksi tunai saat **online**
- [ ] Aktifkan mode pesawat → transaksi tetap bisa disimpan, badge "belum sync" muncul
- [ ] Matikan mode pesawat → antrian terkirim otomatis, badge berubah "tersimpan"
- [ ] Transaksi QRIS (kalau dipakai) → pembayaran nyata nominal kecil, lalu refund
- [ ] Tutup toko → `expected_cash` dan selisih kas benar
- [ ] Ajukan mutasi stok dari kedai A → approve dari admin pusat → stok kedua kedai berubah
- [ ] Cek dashboard owner: omzet cocok dengan transaksi yang barusan dibuat
- [ ] Cek stok berkurang sesuai penjualan, dan ada barisnya di `stock_movements`
- [ ] Gerbang kode: `npm run lint` dan `npm run build` hijau (build di deployment Vercel sudah menjalankan type-check; jalankan ulang di mesin pengelola sebelum serah terima)

---

## 6. Serah terima

- [ ] Serahkan kredensial owner lewat kanal aman (password manager, bukan WhatsApp)
- [ ] Sertakan file `LICENSE` di paket serah terima, dan pastikan isinya konsisten dengan klausul hak pakai di perjanjian
- [ ] Cetak kartu QR karyawan
- [ ] Pelatihan singkat: buka toko → transaksi → tutup toko (30 menit cukup)
- [ ] Jelaskan apa yang terjadi saat internet mati — ini pertanyaan pertama mereka nanti
- [ ] Sepakati kanal dan jam dukungan

### Yang perlu ditekankan ke klien

**Kasir tetap bisa jualan tunai saat internet mati.** Transaksi masuk antrian di HP dan terkirim otomatis begitu online. Yang tidak bisa saat offline: pembayaran QRIS (butuh Midtrans), approval mutasi stok, dan laporan pusat.

**Jangan uninstall aplikasi dari home screen saat masih ada badge "belum sync"** — antriannya ada di penyimpanan browser HP itu. Ini satu-satunya cara data transaksi bisa benar-benar hilang.

**Hak pakai kode, bukan kepemilikan.** Klien mendapat izin menjalankan dan menyesuaikan instance ini untuk bisnis mereka sendiri. Mereka tidak boleh menyalin kodenya, menjalankannya untuk bisnis lain, atau menjualnya kembali sebagai produk. Batas itu tertulis di file `LICENSE` dan harus sama dengan klausul di perjanjian. Kalau klien minta akses kode, jawab dengan klausul lisensi, bukan dengan membuka repo.

---

## 7. Pemeliharaan rutin

| Kapan | Apa |
|---|---|
| Mingguan | Cek log Vercel (dan Sentry begitu M9-3 selesai) — error yang berulang di satu kedai biasanya masalah perangkat, bukan bug |
| Bulanan | Cek `stock_movements` dengan `reason = 'adjustment'` — penyesuaian manual yang sering berarti ada kebocoran atau pencatatan yang keliru |
| Bulanan | Cek shift yang `reconciliation_status` masih `pending_sync` berhari-hari — tandanya ada device yang antriannya tidak pernah terkirim |
| Per kuartal | Ulangi uji restore |
| Per kuartal | Evaluasi biaya per klien (lihat catatan di bawah) |

### Catatan biaya

Supabase menagih **per project**, jadi biaya naik linier terhadap jumlah klien. Di klien ke-3 atau ke-4, evaluasi ulang apakah model 1-project-per-klien masih masuk akal secara ekonomi, atau perlu pindah ke provider dengan model biaya berbeda (mis. Neon dengan scale-to-zero).

Konsekuensi pindah provider ada di `Tasks.md` bagian keputusan desain: database-nya portabel (Postgres biasa), tapi Auth, Storage, dan Realtime adalah titik lock-in-nya.
