# PUSATKEDAI

**POS & Stok Multi-Cabang**

Sistem manajemen multi-cabang untuk bisnis F&B: kasir/POS offline-first, stok per kedai dengan mutasi antar cabang, shift & absensi karyawan, dan laporan terpusat.

Satu deployment = satu bisnis klien (dengan banyak kedai di dalamnya). Bukan SaaS multi-tenant — lihat [`docs/idea.md`](docs/idea.md).

| | |
|---|---|
| **Target** | F&B skala menengah, 4–10 cabang |
| **Lisensi** | Proprietary — [`LICENSE`](LICENSE). Menjual per klien, bukan open source. |
| **Stack** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth) · Dexie.js (antrian offline) · Midtrans (QRIS) |

## Modul

| Modul | Isi |
|---|---|
| **Kasir (POS)** | Grid produk di HP, keranjang, pembayaran tunai dan QRIS, riwayat transaksi |
| **Offline-first** | Antrean transaksi di IndexedDB, kirim otomatis saat online, badge "belum sync" |
| **Karyawan & shift** | Login lewat QR pribadi, absensi, buka/tutup toko, rekonsiliasi kas |
| **Stok** | Stok per kedai, ledger `stock_movements`, mutasi antar kedai dengan approval |
| **Laporan pusat** | Omzet per kedai, perbandingan performa cabang, laporan stok, catatan pengeluaran |

Status pengerjaan ada di [`docs/Milestone.md`](docs/Milestone.md).

## Dokumen

| File | Isi |
|---|---|
| `docs/idea.md` | Masalah, solusi, cakupan MVP, dan apa yang sengaja tidak dikerjakan |
| `docs/Tech.md` | Pilihan tech stack beserta alasannya |
| `docs/design_1.md` | Panduan desain UI — token warna, tipografi, komponen |
| `docs/Database.md` | Skema database + alasan di balik keputusan strukturalnya |
| `docs/Milestone.md` | Roadmap level milestone |
| `docs/Tasks.md` | Task granular: dependensi, estimasi, output, Definition of Done |
| `docs/provisioning.md` | Runbook menyiapkan instance klien baru (Supabase + Vercel + serah terima) |
| `docs/panduan/` | **Panduan developer** — cara kerja kode yang sudah jadi, ditulis untuk yang baru masuk |
| `docs/manual/` | **Manual book** — panduan pemakaian untuk pemilik dan karyawan kedai, bahasa sehari-hari |

Baru pertama kali membuka repo ini? Mulai dari **`docs/panduan/`** (berurutan dari 01). Kalau mau tahu apa yang dikerjakan berikutnya, lihat `docs/Tasks.md`.

## Setup

```bash
npm install
cp .env.example .env.local   # isi kredensial Supabase
npm run dev
```

Di PowerShell, `cp` diganti `Copy-Item .env.example .env.local`.

Untuk menyiapkan instance klien baru (Supabase + Vercel + serah terima), ikuti `docs/provisioning.md`.

## Struktur Folder

```
app/
  admin/          Dashboard owner & admin pusat — layar lebar, sidebar
  pos/            Kasir di HP — mobile-first, bottom navigation
  dev/ui/         Preview komponen & token desain
components/
  ui/             Komponen dasar (Button, Input, Card, Badge, Modal, Table)
  admin/          Shell admin (sidebar + drawer)
  pos/            Komponen khusus kasir (BottomNav, Cart, QrScanner, SyncStatus)
  pwa/            Registrasi service worker
lib/
  supabase/       Client Supabase (server & browser) + tipe hasil generate
  auth/           Sesi admin (Supabase Auth) & sesi karyawan (QR token)
  pos/            Logika transaksi & penomoran
  offline/        Dexie, antrian sync, cache katalog
supabase/
  migrations/     Migration SQL, dijalankan berurutan
  tests/          Uji database — SQL transaksional dengan rollback
docs/             Dokumen perencanaan (idea, tech, desain, skema, roadmap)
                  + panduan developer (panduan/), manual book (manual/),
                  dan dokumentasi operasional (provisioning)
```

## Konvensi

**Design token.** Semua warna, radius, shadow, dan ukuran font didefinisikan di blok `@theme` pada `app/globals.css`. Jangan tulis hex code di komponen. Kalau butuh nilai baru, tambahkan ke `docs/design_1.md` dulu, baru ke `globals.css`.

Perhatikan: class `text-primary` berarti **teks berwarna brand kuning**, yang tidak terbaca di atas putih. Warna teks utama adalah `text-ink`. Penamaan ini disengaja — lihat komentar di `globals.css` dan `docs/design_1.md`.

Warna status solid (`success`, `warning`, `danger`, `info`) juga tidak boleh dipakai sebagai teks di atas putih. Untuk teksnya ada versi gelap: `text-success-text`, `text-warning-text`, `text-danger-text`, `text-info-text`.

**Radius dan shadow.** Semua `--radius-*` di `@theme` bernilai 0, jadi `rounded-*` yang terlupa tetap siku. Shadow hanya boleh `shadow-brutal-sm` / `shadow-brutal` / `shadow-brutal-lg` (offset keras, tanpa blur). Jangan pakai `shadow-lg` atau `drop-shadow`. Tombol yang punya shadow wajib memakai `press-brutal`.

**Spacing.** Hanya nilai dari skala `docs/design_1.md`: 4, 8, 12, 16, 24, 32, 48, 64 px (= `1, 2, 3, 4, 6, 8, 12, 16` di Tailwind). Jangan pakai `p-5`, `gap-7`, dan sejenisnya.

**Tap target.** Semua elemen interaktif di POS minimal 44x44px — pakai utility `tap-target`. Kasir bekerja cepat di HP; salah pencet berarti transaksi salah.

**Ikon.** Lucide (`lucide-react`) saja. Jangan campur icon set lain, jangan pakai emoji sebagai ikon fungsional.

**Stok tidak pernah di-UPDATE langsung.** Setiap perubahan `kedai_stock.quantity` wajib disertai baris di `stock_movements` dalam DB transaction yang sama. Ledger itu satu-satunya jejak audit kalau stok fisik tidak cocok.

**Transaksi bersifat append-only.** Pembatalan memakai status `void` + movement pembalik, bukan DELETE.

**Tiga client Supabase, jangan tertukar.** `lib/supabase/client.ts` (browser) dan `server.ts` (server component/action) memakai anon key dan tunduk RLS. `admin.ts` memakai service role dan **melewati seluruh RLS** — hanya untuk sync transaksi, eksekusi mutasi stok, rekonsiliasi shift, dan sesi karyawan QR. Setiap pemakaian `admin.ts` wajib memfilter `kedai_id` secara eksplisit; RLS tidak akan menolong di sana.

**Karyawan tidak lewat Supabase Auth.** Hanya admin/owner yang punya akun Auth. Karyawan login lewat QR token, jadi RLS tidak bisa membatasi mereka per kedai — pembatasan itu tanggung jawab lapisan server.

**Rute dipisah `/admin/*` dan `/pos/*`.** Bukan route group Next — route group tidak menambah segmen URL, sehingga halaman stok admin dan stok kasir akan bertabrakan di `/stok`. Pemisahan ini juga yang membuat middleware auth bisa membedakan sesi admin dan sesi karyawan hanya dari prefix path.

## Perintah

```bash
npm run dev     # development server
npm run build   # production build
npm run lint    # eslint
npm run icons   # regenerate ikon PWA dari app/icon.svg (jalankan saat ikon berubah)

npm run seed                                    # reset + isi data dev (TRUNCATE!)
npm run seed:minggu                             # idem, tapi pakai supabase/seed-minggu.sql
npm run gen:types                               # regenerate lib/database.types.ts dari skema
npm run db -- -e "select count(*) from kedai"   # query lepas

# Uji database — satu file satu kali, semua transaksional dengan rollback
npm run db -- supabase/tests/schema-check.sql   # cek drift skema
npm run db -- supabase/tests/constraints.sql
npm run db -- supabase/tests/rls.sql
npm run db -- supabase/tests/transaction.sql
npm run db -- supabase/tests/void.sql
npm run db -- supabase/tests/void-review.sql
npm run db -- supabase/tests/stok.sql
npm run db -- supabase/tests/mutasi.sql
npm run db -- supabase/tests/kas-keluar.sql
npm run db -- supabase/tests/shift.sql
npm run db -- supabase/tests/laporan.sql
npm run db -- supabase/tests/laporan-harian.sql
npm run db -- supabase/tests/qris.sql
```

Skrip DB memuat env dari `.env.local` (bukan dari shell) dan butuh `SUPABASE_DB_URL`. Fixture bersama sudah dimuat otomatis oleh `npm run db`. Penjelasan tiap file uji ada di `docs/panduan/02-database.md`.

Jalankan `npm run gen:types` setiap kali ada migration baru — tipe TypeScript tidak ikut berubah sendiri.

`npm run seed` menghapus seluruh data operasional. Ada pengaman: menolak jalan kalau tabel `transactions` sudah berisi data, kecuali dipaksa `-- --force`.

Akun admin dev (masuk lewat `/admin/login`): owner `owner@kedaidev.test` / `dev-owner-2026`; admin pusat `admin@kedaidev.test` / `dev-admin-2026`.

## Halaman Bantu

`/dev/ui` — preview seluruh komponen dan token desain. Dipakai sebagai acuan saat audit UI (M6-1). Kalau ada komponen di aplikasi yang menyimpang dari halaman ini, yang salah komponennya.

`/offline` — fallback yang disajikan service worker saat navigasi gagal karena tidak ada koneksi.

## Lisensi

Proprietary, © 2026 Marshell Devilito Fitriawan. Bukan open source — repo ini tidak punya lisensi open source dan tidak diberikan permission di luar ketentuan [`LICENSE`](LICENSE). Klien mendapat izin menjalankan dan menyesuaikan satu instance untuk bisnisnya sendiri; menyalin, menjual, atau menjalankan instance yang sama untuk bisnis lain dilarang.
