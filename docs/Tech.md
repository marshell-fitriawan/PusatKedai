# Tech.md — Tech Stack (Sistem Multi-Kedai)

## Konteks yang Menentukan Pilihan
- Model deployment: **instance terpisah per klien** (bukan shared multi-tenant SaaS) — jadi stack harus murah dan cepat di-*spin up* ulang untuk klien baru.
- Kasir dipakai di **HP sebagai device utama**, wajib **offline-first**.
- Hosting: **cloud murah & mudah** (bukan kelola VPS sendiri).
- Preferensi pengguna: **Next.js + Postgres**.

## Stack Utama

| Layer | Pilihan | Alasan |
|---|---|---|
| Frontend + Backend | **Next.js (App Router, TypeScript)** | Satu framework untuk UI dan API routes/server actions — mengurangi kompleksitas repo per klien |
| Styling | **Tailwind CSS** | Cocok dengan pendekatan design token di `design_1.md`, cepat untuk build UI konsisten |
| Database | **PostgreSQL** (lewat **Supabase**) | Sesuai preferensi Postgres; Supabase membungkus Postgres + Auth + Storage + Realtime dalam satu provisioning cepat — pas untuk "spin up instance baru per klien" |
| Auth | **Supabase Auth** | Email/password untuk admin pusat/owner |
| Auth kasir/karyawan | **QR code custom** (bukan Supabase Auth) | Tiap karyawan punya token QR unik (disimpan di tabel `employees`), di-scan untuk absen + mulai sesi kasir — lebih cepat dari input email/password di tiap pergantian shift |
| Realtime sync | **Supabase Realtime** | Update stok/status approval mutasi antar kedai secara live di dashboard |
| Offline storage (POS) | **IndexedDB via Dexie.js** | Antrian transaksi lokal di HP kasir saat offline, dengan `client_transaction_id` (UUID) dibuat di device supaya sync ke server idempotent (tidak dobel saat retry) |
| Sync strategy | **Background sync + retry queue** (Service Worker / custom polling saat online) | Begitu koneksi kembali, antrian transaksi lokal dikirim berurutan ke server; konflik ditangani dengan "server wins" untuk data stok, transaksi selalu append-only |
| PWA | **next-pwa** atau manual service worker + manifest | Supaya kasir bisa "install" ke home screen HP, terasa seperti app native tanpa perlu develop native terpisah |
| Payment gateway | **Midtrans** (QRIS + metode lain) | Provider Indonesia yang umum, mendukung QRIS untuk kebutuhan MVP |
| QR generation & scan | **`qrcode`** (generate QR karyawan), **`html5-qrcode`** atau **`@zxing/browser`** (scan via kamera HP) | Library ringan, jalan di browser tanpa app native |
| State/data fetching | **TanStack Query (React Query)** | Cocok dipasangkan dengan strategi offline-first (cache-first, sync di background) |
| Hosting aplikasi | **Vercel** | Deploy Next.js paling mudah, tiap klien = 1 project Vercel terpisah (selaras dengan model instance-per-klien) |
| Hosting database | **Supabase** (1 project per klien) | Provisioning cepat untuk instance baru, termasuk backup otomatis |
| Monitoring/error tracking | **Sentry** (opsional tapi disarankan sejak awal) | Karena tiap klien instance terpisah, penting cepat tahu kalau ada error di instance tertentu |

## Payload dan Performa

Target perangkat adalah HP kasir di jaringan seluler, jadi yang diukur adalah
ukuran yang benar-benar diunduh — bukan ukuran file di disk.

| Aset | Ukuran | Cara menjaga |
|---|---|---|
| CSS global | 27,5 KB mentah / 6,5 KB gzip | Token di `@theme`, class dari `@source` eksplisit |
| Font (2 family, subset latin) | 48,4 KB woff2 | Variable font, `preload: true`, jangan tambah family ketiga |

Tiga keputusan teknis yang perlu dijaga (detail lengkap ada di
[design_1.md](design_1.md#budget-performa)):

1. **`source(none)` + daftar `@source`.** Tailwind v4 memindai seluruh repo
   yang tidak di-gitignore, termasuk `docs/*.md` yang memuat daftar class
   terlarang. Membatasinya ke direktori kode membuang 10 class yang tidak
   pernah dipakai.
2. **Shadow brutalist sebagai `@utility`, bukan `--shadow-*` di `@theme`.**
   Menghindari pipeline compositor internal Tailwind yang tidak berguna untuk
   brutalism.
3. **Subsetting font lewat `subsets: ["latin"]`.** `@font-face` untuk cyrillic
   dan latin-ext tetap ter-*emit* tapi tidak pernah diunduh karena
   `unicode-range`-nya tidak cocok dengan teks Indonesia.

## Struktur Proyek yang Disarankan
Karena tiap klien punya instance terpisah, disarankan menyiapkan **satu repo template/boilerplate** (bukan copy-paste manual tiap klien), lalu tiap klien = 1 deployment dari template yang sama dengan konfigurasi (`.env`, branding ringan, kedai awal) yang berbeda. Ini menyeimbangkan antara "instance terpisah" (sesuai keputusan bisnis) dengan "tidak membangun ulang dari nol tiap ada klien baru".

## Hal yang Sengaja Belum Dipilih (Diputuskan Nanti)
- Provider WhatsApp/notifikasi (tidak perlu untuk MVP — tidak ada fitur notifikasi di scope MVP)
- Printer ESC-POS/Bluetooth (belum masuk MVP)
- Payment gateway kedua sebagai alternatif Midtrans (misalnya Xendit) — evaluasi setelah klien pertama jalan
