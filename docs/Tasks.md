# Tasks.md — Pembagian Task Detail (Sistem Multi-Kedai)

Turunan granular dari `Milestone.md`. Setiap task punya ID, dependensi, output konkret, dan Definition of Done (DoD).
Aturan: task hanya boleh diambil kalau semua dependensinya sudah selesai. Task bertanda `[P]` bisa dikerjakan paralel dengan sesama `[P]` di milestone yang sama.

Legenda ukuran: **S** = < 2 jam · **M** = setengah hari · **L** = 1–2 hari

---

## M0 — Setup & Fondasi
Tujuan: repo jalan, DB siap, auth admin jalan, app bisa di-install di HP.

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M0-1 | Init repo Next.js (App Router, TS) + Tailwind + ESLint | — | S | `package.json`, `app/`, `tsconfig.json` | Next.js 16.3.3 + React 19.2 + Tailwind v4; `npm run build` & `npm run lint` bersih |
| ✅ M0-2 [P] | Design token sebagai CSS variables (warna, tipografi, radius, shadow) sesuai `design_1.md` | M0-1 | M | `app/globals.css` (blok `@theme`) | Semua token jadi utility class; tidak ada hex manual di komponen |
| ✅ M0-3 [P] | Setup font Plus Jakarta Sans via `next/font` + `tabular-nums` untuk tabel | M0-1 | S | `app/layout.tsx`, `app/globals.css` | Font di-*self-host* Next (bukan CDN blocking), angka tabel sejajar |
| ✅ M0-4 [P] | Struktur folder: `app/admin`, `app/pos`, `lib/`, `components/`, `supabase/`, `docs/` | M0-1 | S | Struktur direktori | Konvensi tertulis di `README.md`, tidak ada file nyasar |
| ✅ M0-5 | Project Supabase (dev) + env di `.env.local` dan `.env.example` | — | S | `.env.example` | Terhubung; service role valid. `SUPABASE_DB_URL` **wajib Session pooler** — host direct IPv6-only, lihat penyimpangan |
| ✅ M0-6 | Migration skema awal (12 tabel dari `Database.md`) | M0-5 | L | `supabase/migrations/0001_init.sql` | Diterapkan; 12 tabel, 33 index, 32 CHECK, 31 FK; nol drift (`supabase/tests/schema-check.sql`) |
| ✅ M0-6b | Uji constraint level DB (insert yang seharusnya gagal, memang gagal) | M0-6 | M | `supabase/tests/constraints.sql` | **30/30 lulus**, transaksional + rollback. Termasuk uji positif: stok negatif memang diizinkan |
| ✅ M0-7 | Seed data dev: 2 kedai + gudang, 2 akun admin, 3 karyawan, 10 produk, bahan baku, dan 14 hari histori transaksi | M0-6 | M | `supabase/seed.sql`, `scripts/seed.mjs` | `npm run seed` idempotent; stok awal lewat ledger `initial`, bukan UPDATE langsung. Semua perubahan stok/ transaksi lewat RPC resmi, bukan UPDATE telanjang. Demo siap pakai: 136 transaksi tunai, Melati tanpa shift terbuka (supaya "Buka Toko" bisa didemokan), Kenanga terbuka (supaya ada void yang menunggu), 4 item di Perlu Perhatian. Nol QRIS — `supabase/seed-minggu.sql` tetap dataset alternatif |
| ✅ M0-8 | Supabase client helper (server, browser, admin) + typed schema | M0-5, M0-6 | M | `lib/supabase/{client,server,admin,env}.ts`, `lib/database.types.ts`, `scripts/gen-types.mjs` | 12 tabel + 30 relasi ter-generate; kolom status jadi union dari CHECK; `tsc --noEmit` lulus |
| ✅ M0-9 | Supabase Auth admin (email/password) + middleware proteksi `/admin/*` | M0-8 | M | `middleware.ts`, `lib/auth.ts`, `app/admin/actions.ts` | Tanpa sesi → 307 ke login (tujuan awal disimpan di `?next=`); sudah login → login page balik ke dashboard; login sah tapi bukan admin → ditolak `?error=forbidden` |
| ✅ M0-10 | RLS: admin full access, selain itu ditolak total | M0-6 | L | `supabase/migrations/0002_rls.sql`, `supabase/tests/rls.sql` | 4/4 uji lulus: anon nol baris, login-bukan-admin nol baris, admin dapat data, admin dinonaktifkan langsung terputus |
| ✅ M0-11 | PWA dasar: manifest, ikon, service worker, meta viewport | M0-1 | M | `app/manifest.ts`, `app/icon.svg`, `public/sw.js`, `public/icons/*` | Manifest + ikon 192/512/maskable tersaji; SW terdaftar di produksi; `/offline` jadi fallback navigasi |
| ✅ M0-12 | Komponen UI dasar: Button, Input, Card, Badge, Modal/BottomSheet, Table | M0-2, M0-3 | L | `components/ui/*`, `lib/utils.ts` | Semua varian sesuai `design_1.md`; tap target ≥ 44px; halaman preview `/dev/ui` jalan |

---

## M1 — Kasir/POS Inti (online dulu)
Tujuan: alur jual paling dasar jalan end-to-end saat online.

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M1-1 | Halaman login admin (email/password) + error state | M0-9, M0-12 | M | `app/admin/login/page.tsx`, `components/admin/login-form.tsx` | Login sukses → dashboard; gagal → pesan seragam (tidak membocorkan email mana yang terdaftar); `?next=` divalidasi agar tidak jadi open redirect |
| ✅ M1-2 | Layout admin (sidebar desktop, drawer di bawah breakpoint tablet) | M0-12 | M | `app/admin/layout.tsx`, `components/admin/admin-shell.tsx` | Sidebar tetap di ≥ md, drawer `<dialog>` di bawahnya; nav aktif ditandai `aria-current` |
| ✅ M1-3 | CRUD kedai (nama, alamat, telepon, zona waktu, ambang stok, status aktif) | M1-2 | M | `app/admin/(dashboard)/kedai/*`, `components/admin/kedai-{list,form}.tsx` | Tambah/ubah/nonaktifkan jalan; validasi Zod di server; kedai tidak bisa dihapus (hanya dinonaktifkan) |
| ✅ M1-4 | CRUD produk (nama, harga, kategori, gambar via Supabase Storage) | M1-2 | L | `app/admin/(dashboard)/produk/*`, `lib/storage{,-client}.ts`, `supabase/migrations/0003_storage_produk.sql` | Gambar diunggah browser→Storage langsung (bukan lewat server action, batas 1MB); policy Storage teruji: anon ditolak, MIME salah ditolak bucket |
| ✅ M1-5 | Layout POS mobile + bottom nav (Kasir, Stok, Riwayat, Shift) | M0-12 | M | `app/pos/layout.tsx`, `components/pos/bottom-nav.tsx` | 4 item, tinggi 56px, aman dari gesture bar (`safe-area-inset-bottom`) |
| ✅ M1-6 | Grid produk kasir (2 kolom di HP) + filter kategori + search | M1-4, M1-5 | L | `app/pos/(kasir)/kasir/page.tsx`, `components/pos/kasir-screen.tsx` | Grid dari DB, stok per kedai teruji terisolasi (Melati 40 vs Kenanga 25); badge stok menipis ikut ambang tiap kedai |
| ✅ M1-7 | Keranjang: tambah/kurang qty, hapus item, hitung subtotal & total | M1-6 | L | `lib/pos/cart.ts`, `components/pos/kasir-screen.tsx` | Logika keranjang dipisah dari komponen agar bisa dipindah ke IndexedDB di M2 tanpa menyentuh UI; harga di-*snapshot* saat masuk keranjang |
| ✅ M1-8 | Simpan transaksi tunai (header + items, UUID dibuat di client) | M1-7, M0-8, M3-4, M3-6 | L | `supabase/migrations/0004_create_transaction.sql`, `app/api/sync/transactions/route.ts` | Header + item + stok + ledger dalam **satu** DB transaction; idempoten (kirim ulang → nomor sama, stok tidak berkurang lagi); RPC dicabut dari anon/authenticated |
| ✅ M1-9 | Penomoran dua lapis: `local_number` di device + `transaction_number` final di server per (`kedai_id`,`business_date`) | M1-8 | M | fungsi SQL + `lib/pos/local-number.ts` | Advisory lock menyerialkan penomoran per kedai+tanggal; teruji nomor naik 1→2; total dihitung ulang server, bukan dipercaya dari client |
| ⛔ M1-10 | ~~Pembayaran QRIS Midtrans~~ — **OUT OF SCOPE untuk klien Malaysia** | M1-8, M1-9 | L | `lib/payment/midtrans.ts`, `lib/payment/settle-qris.ts`, `app/api/midtrans/status/route.ts`, `app/pos/(kasir)/kasir/actions.ts`, `components/pos/kasir-screen.tsx` | Sudah dibangun & diverifikasi. Dihentikan karena klien Malaysia (QRIS = standar Indonesia; ekuivalennya DuitNow). Kode, tabel `qris_payments`, dan fungsi `confirm_qris_payment` **ditahan, tidak dipakai** — menghapusnya tanpa klien pengganti hanya membuang kerja. Kasir hanya metode `tunai` |
| ⛔ M1-11 | ~~Webhook Midtrans~~ — **OUT OF SCOPE untuk klien Malaysia** (lihat M1-10) | M1-10 | M | `app/api/midtrans/webhook/route.ts`, `supabase/migrations/0012_qris_payments.sql` | Sudah dibangun & diverifikasi E2E. Ditahan bersama M1-10 |
| ✅ M1-12 | Konfirmasi sukses transaksi (nomor + total + tombol transaksi baru) | M1-8 | S | `components/pos/kasir-screen.tsx` | Dibuat sebagai keadaan modal keranjang, **bukan halaman terpisah** — kasir tidak perlu berpindah layar lalu kembali di antara pelanggan |
| ✅ M1-13 | Riwayat transaksi per kedai (list + detail + filter tanggal) | M1-8 | M | `app/pos/(kasir)/riwayat/*`, `components/pos/riwayat-list.tsx` | Difilter `kedai_id` + `business_date` zona kedai; menampilkan `local_number` bila nomor final belum ada (relevan saat antrian offline M2) |
| ✅ M1-14 | Void transaksi (ubah status `void`, catat pelakunya) | M1-13 | M | `supabase/migrations/0005_void_transaction.sql`, `app/pos/(kasir)/riwayat/actions.ts` | **10/10 uji lulus.** Stok dikembalikan lewat movement pembalik (baris `sale` tidak dihapus); idempoten; kedai lain ditolak; shift yang sudah ditutup ditolak |
| ✅ M1-15 | Layout POS tablet/desktop: `SideNav` + panel keranjang permanen | M1-5, M1-7 | M | `components/pos/side-nav.tsx`, `app/pos/(kasir)/layout.tsx`, `components/pos/kasir-screen.tsx` | Breakpoint `lg` (1024px) — satu titik peralihan, dipilih lewat prefixed Tailwind bukan deteksi viewport; grid produk 2 kolom di `lg` → 4 di `2xl`; isi & aksi keranjang diekstrak ke `IsiKeranjang`/`AksiBayar` supaya modal (HP) dan panel (layar lebar) tidak bisa melenceng; bilah ringkasan disembunyikan di `lg+` agar total tidak tampil dua tempat |
| ✅ M1-16 | Halaman pertama + halaman masuk: layout dua kolom untuk laptop/desktop | M1-15 | S | `components/ui/auth-shell.tsx`, `app/page.tsx`, `app/admin/login/page.tsx`, `app/pos/masuk/page.tsx` | Ketiga halaman memakai satu kerangka `AuthShell` yang memecah layar di `lg` (1024px), sama seperti POS. Kolom kiri menjelaskan sistem, kolom kanan mengerjakan tugas; tidak ada teks yang muncul dua kali. Tautan halaman pertama diarahkan ke halaman masuk (`/pos/masuk`, `/admin/login`) supaya tidak satu perpindahan sia-sia. Copy lama "Modul-modulnya belum dibangun" dihapus karena tidak benar anymore |

---

## M2 — Offline-First Kasir
Tujuan: kasir tetap bisa jual saat internet mati, tanpa data dobel atau hilang.

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M2-1 | Setup Dexie.js: skema lokal (antrian, cache produk, meta) | M1-8 | M | `lib/offline/db.ts` | Skema ter-versi; komentar menjelaskan kenapa IndexedDB, bukan localStorage atau cache service worker |
| ✅ M2-2 | Cache katalog produk + stok ke IndexedDB saat online | M2-1, M1-6 | M | `lib/offline/catalog.ts` | Katalog ditimpa seluruhnya per kedai, bukan digabung — produk yang dinonaktifkan admin ikut hilang dari perangkat |
| ✅ M2-3 | Alihkan simpan transaksi ke queue lokal dulu (write-local-first) | M2-1, M1-8 | L | `components/pos/kasir-screen.tsx` | Transaksi ditulis ke IndexedDB lalu kasir langsung dilepas; pengiriman di latar. Server action lama dihapus agar tidak ada dua jalur |
| ✅ M2-4 | Endpoint sync batch idempotent (`POST /api/sync/transactions`) | M2-3, M0-6, M1-9 | L | `app/api/sync/transactions/route.ts` | Teruji: tanpa sesi 401, batch 2 transaksi → nomor 3 & 4, kirim ulang → nomor sama tanpa duplikat, payload invalid 400, shift tertutup 409 |
| ✅ M2-5 | Worker sync: deteksi online, kirim antrian berurutan, retry | M2-4 | L | `lib/offline/sync-queue.ts` | Item dihapus HANYA setelah server mengonfirmasi; satu proses sync per tab; gagal jaringan kembali ke pending, bukan ditandai error |
| ✅ M2-6 | Indikator UI: badge status + jumlah antrian | M2-5, M0-12 | M | `components/pos/sync-status.tsx` | Angka diturunkan dari isi IndexedDB lewat `useLiveQuery` — tidak ada state hitungan manual yang bisa menyimpang dari antrian sebenarnya |
| ✅ M2-7 | Penanganan error permanen (ditolak server → antrian error, retry manual) | M2-5 | M | `lib/offline/sync-queue.ts`, UI | Error constraint (23xxx) ditandai permanen dan berhenti diulang; muncul di UI dengan tombol Coba lagi. Transaksi gagal tidak hilang diam-diam |
| 🟡 M2-8 | Uji skenario: offline penuh, offline→online, putus di tengah sync, 2 device | M2-5, M2-7 | L | `docs/test-offline.md` | **Sisi server teruji** (idempotensi, 409, batch). **Sisi perangkat BELUM** — IndexedDB dan mode pesawat tidak bisa diuji dari baris perintah, butuh HP fisik |

---

## M3 — Karyawan & Sesi Kasir (QR login, tanpa absensi)

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M3-1 | CRUD karyawan per kedai + generate `qr_token` unik (kriptografis) | M1-3 | M | `app/admin/(dashboard)/karyawan/*`, `components/admin/karyawan-{form,list}.tsx` | Token dibuat server (`randomBytes(18).base64url`), bukan client; hard delete dilarang — nonaktif via `is_active`; QR token bisa diterbitkan ulang (memadam semua kartu lama) |
| ✅ M3-2 | Halaman cetak/unduh kartu QR karyawan | M3-1 | S | `app/admin/(dashboard)/karyawan/[id]/page.tsx`, `components/ui/print-button.tsx` | QR di-generate server dari `qr_token` (`qrcode`); `@media print` menyembunyikan UI admin, hanya `.print-area` yang tercetak; token tetap tampil sebagai fallback teks. Template kertas belum diukur |
| 🟡 M3-3 | Scanner QR di POS (kamera HP, `html5-qrcode`/zxing) + fallback input manual | M1-5 | M | `components/pos/qr-scanner.tsx`, `components/pos/masuk-form.tsx` | Kamera diimpor dinamis; fallback manual selalu tersedia. Jalur kamera BELUM diuji di perangkat nyata |
| ✅ M3-4 | Sesi karyawan dari QR (validasi token → session cookie ber-scope kedai) | M3-3, M3-1, M0-10 | L | `lib/pos/session.ts`, `app/pos/actions.ts`, `components/pos/{masuk-form,qr-scanner}.tsx` | Token sah → 303 + cookie httpOnly; token palsu → ditolak tanpa cookie; `kedai_id` diambil dari data karyawan, bukan input. Jalur kamera BELUM diuji di perangkat nyata |
| 🚮 M3-5 | ~~Clock-in / clock-out → `attendance`~~ — **DIHAPUS** | — | M | ~~absensi~~ | Absensi dibuang (keputusan adaptasi klien Malaysia). QR hanya untuk login kasir + otorisasi buka kedai. Tabel `attendance` di-drop di migration baru; kode clock-in/out dihapus |
| ✅ M3-6 | Alur buka toko: input kas awal → buat `shifts` status `open` | M3-4 | M | `app/pos/(kasir)/shift/*`, `lib/pos/shift.ts`, `components/pos/buka-toko-form.tsx` | Shift kedua ditolak partial unique index dengan pesan ramah; `business_date` memakai zona waktu kedai (6/6 uji lintas WIB/WITA/WIT lulus) |
| ✅ M3-7 | Kaitkan transaksi ke shift aktif (termasuk transaksi offline) | M3-6, M2-3 | M | `lib/offline/db.ts`, `app/api/sync/transactions/route.ts` | Tiap item antrian menyimpan `shiftId` saat penjualan TERJADI. Server memverifikasi shift itu milik kedai pada sesi, lalu merekonsiliasi tiap shift yang terdampak |
| ✅ M3-8 | Alur tutup toko: input kas fisik, server hitung `expected_cash` & `cash_difference` | M3-6, M1-8 | L | `supabase/migrations/0006_close_shift.sql`, `components/pos/tutup-toko-form.tsx` | **13/13 uji lulus.** Idempoten (tutup ulang tidak menimpa kas); kedai lain ditolak; transaksi void tidak dihitung |
| ✅ M3-9 | Rekonsiliasi tertunda: tutup dengan antrian belum kosong → `pending_sync`, server hitung ulang tiap sync sampai `final` | M3-8, M2-5 | L | `reconcile_shift()`, kolom `shifts.pending_sync_count` | Teruji: selisih sementara +56.000 terkoreksi jadi −32.000 setelah antrian masuk. Perangkat melaporkan jumlah antrian; server menurunkannya sampai nol |
| ✅ M3-10 | Riwayat shift per kedai (admin) + detail selisih kas | M3-9, M1-2 | M | `app/admin/(dashboard)/shift/page.tsx`, `components/admin/shift-list.tsx` | Filter per kedai & rentang tanggal (form GET tanpa JS); shift `pending_sync` berbadge kuning dan ditandai jelas + dikecualikan dari total selisih |

---

## M4 — Stok & Mutasi Antar Kedai

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M4-1 | CRUD stok awal per kedai (`kedai_stock`) + bulk set | M1-3, M1-4 | M | `app/admin/(dashboard)/stok/page.tsx`, `components/admin/stok-list.tsx` | Halaman stok admin + `adjust_stock`; unique (`kedai_id`,`product_id`) terjaga. Set per-produk via modal — bulk set belum dibuat, bukan kebutuhan mendesak |
| ✅ M4-2 | Pengurangan stok server-side — tulis `kedai_stock` + `stock_movements` dalam 1 transaction | M4-1 | L | `supabase/migrations/000{4,5}_*.sql` | Pengurangan saat jual (12/12) dan pengembalian saat void (10/10), keduanya idempoten. Ledger menyimpan `sale` dan `void` berdampingan — riwayat tidak pernah dihapus |
| ✅ M4-2b | Penyesuaian stok manual (`adjustment`) dengan alasan wajib | M4-2 | M | `app/admin/(dashboard)/stok/actions.ts` (`setStok` → RPC `adjust_stock`) | Tidak ada jalur lain yang meng-UPDATE `kedai_stock` langsung; alasan kosong ditolak (Zod + CHECK DB) |
| ✅ M4-2c | Halaman riwayat pergerakan stok per kedai/produk (audit trail) | M4-2 | M | `riwayatStok` di `app/admin/(dashboard)/stok/actions.ts` + modal di `stok-list.tsx` | Modal riwayat menelusuri mundur ke `initial`; menampilkan alasan, delta, saldo setelah |
| ✅ M4-3 | Form pengajuan mutasi stok antar kedai (status `pending`) | M4-1 | M | `app/pos/(kasir)/stok/actions.ts` (`ajukanMutasi`) + modal `stok-screen.tsx` | `from_kedai_id` dari sesi (bukan input); stok kurang → peringatan, bukan larangan; tujuan ≠ kedai sendiri |
| ✅ M4-4 | Halaman approval mutasi (admin pusat: setujui/tolak + catatan) | M4-3, M1-2 | M | `app/admin/(dashboard)/mutasi/*`, `components/admin/mutasi-list.tsx` | Hanya admin pusat yang bisa approve (requireAdmin + service role); tolak wajib alasan; tolak hanya untuk status `pending` |
| ✅ M4-5 | Eksekusi perpindahan stok setelah `approved` (atomic: 2 baris ledger + 2 update saldo + `executed_at`) | M4-4, M4-2 | L | `supabase/migrations/0009_approve_mutation.sql` | **7/7 uji lulus.** Approve double ditolak idempoten (guard status + unique `movements_once_per_mutation`); stok asal dicek saat eksekusi dengan `for update`; kedai tujuan tanpa stok diisi upsert |
| ✅ M4-6 | Tampilan stok per kedai + indikator stok menipis & stok minus | M4-1, M0-12 | M | `app/pos/(kasir)/stok/page.tsx`, `components/pos/stok-screen.tsx` | Badge `warning` di bawah `low_stock_threshold`, `danger` saat ≤ 0; riwayat mutasi keluar tampil di POS |
| M4-7 | Realtime update status mutasi & stok (Supabase Realtime) | M4-5 | M | `lib/realtime/*` | Approve di admin → tampilan kedai berubah tanpa refresh |

---

## M5 — Laporan Pusat & Pengeluaran

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M5-1 | Input pengeluaran per kedai (kategori, jumlah, tanggal, pencatat) | M1-3 | M | `app/admin/pengeluaran/*`, `components/admin/pengeluaran-list.tsx` | Kategori daftar tetap (CHECK DB + Zod); pencatat dari sesi admin bukan form; boleh dihapus (tidak menyentuh ledger) |
| ✅ M5-2 | Query agregasi omzet (harian/mingguan/bulanan per kedai) | M1-8 | L | `supabase/migrations/0010_report.sql` (`report_omzet`, `report_laba_rugi`) | **14/14 uji lulus** (`supabase/tests/laporan.sql`): void dikecualikan, bucket mingguan/bulanan benar, kedai kosong tetap muncul, gudang pusat dikecualikan (0020), anon ditolak / authenticated diberi (0011) |
| ✅ M5-3 | Dashboard omzet per kedai (kartu ringkasan + grafik tren) | M5-2, M1-2 | L | `app/admin/dashboard/page.tsx` | Form GET gran+dari+sampai; angka `tabular-nums`; chart CSS murni tanpa library; selisih warnai sukses/danger |
| ✅ M5-4 | Perbandingan performa antar kedai (tabel side-by-side + grafik) | M5-2 | M | `app/admin/dashboard/perbandingan` | Grouped bars per kedai + tabel dengan pertumbuhan ↗/↘ dan porsi; badge semantik sesuai `design_1.md` |
| ✅ M5-5 | Laporan stok konsolidasi semua kedai | M4-1 | M | `app/admin/laporan/stok` | Pivot produk × kedai; cell kuning ≤ threshold / merah = 0; produk tanpa baris stok dihitung 0; export CSV |
| ✅ M5-6 | Ringkasan untung-rugi kasar (omzet − pengeluaran) per kedai | M5-2, M5-1 | M | `app/admin/laporan/laba-rugi` | Fungsi DB tunggal (satu definisi omzet); void dikecualikan; kedai tanpa data muncul 0; label "kasar" eksplisit; export CSV |
| ✅ M5-7 | Export CSV laporan (omzet, stok, pengeluaran) | M5-3, M5-5 | M | `lib/export/csv.ts`, `components/admin/export-csv-button.tsx` | Delimiter `;` + BOM UTF-8 + RFC 4180; angka mentah agar bisa dijumlahkan di Excel |

---

## M6 — Stok Dua Lapis: Bahan Mentah, Produksi & Assign (klien Malaysia)

Arah adaptasi: tambah lapisan **stok mentah** + **produksi input manual** di gudang pusat, lalu **assign** stok jadi ke kedai. Pinjam seluruh mekanisme `stock_mutations` yang sudah ada dengan menandai gudang pusat sebagai `kedai.is_warehouse`.

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M6-0 | Pindah tampilan mata uang ke Ringgit Malaysia (`RM`) | M1-2 | S | `lib/format-uang.ts` (+ pemakaian di POS & admin) | Semua nominal kasir/admin tampil prefix `RM`; data `numeric(12,2)` tidak berubah |
| ✅ M6-1 | `kedai.is_warehouse`: tandai gudang pusat + form kelola kedai | M1-3 | S | migration + `components/admin/kedai-form.tsx` | Tabel `kedai` punya kolom `is_warehouse`; admin bisa menandai satu lokasi sebagai gudang; `gen:types` jalan |
| ✅ M6-2 | CRUD bahan mentah (nama, satuan, harga beli opsional) | M1-3 | M | `app/admin/(dashboard)/bahan/*`, `components/admin/bahan-{form,list}.tsx` | Katalog `bahan_mentah`; nonaktif via `is_active`; satuan bebas (text) |
| ✅ M6-3 | Penambahan manual stok bahan → ledger `bahan_movement` (+ koreksi) | M6-2 | M | RPC `record_bahan_movement` + form tambah/koreksi | Setiap perubahan bahan = 1 baris ledger + update `bahan_stock` dalam 1 transaction; koreksi wajib alasan; `gen:types` |
| ✅ M6-4 | Produksi manual: banyak bahan → satu produk jadi di gudang pusat | M6-1, M6-2 | L | RPC `record_produksi` + `app/admin/(dashboard)/produksi/*` | Bahan dicek cukup (`for update`), kurang → seluruh produksi ditolak; hasil masuk `kedai_stock` gudang (reason `produksi`); idempoten per `produksi.id`; 1 transaction |
| ✅ M6-5 | Assign stok jadi gudang → kedai via `stock_mutations` (auto-approve sebagai pemilik) | M6-1, M4-5 | M | `app/admin/(dashboard)/mutasi/*` (mode assign) | Assign dari warehouse tanpa menunggu approval; retur kedai→gudang via mutasi biasa (pending) kalau dari karyawan |
| ✅ M6-6 | Indikator stok mentah & stok jadi di admin (stok menipis kontekstual) | M6-3, M6-4 | M | dashboard/stok admin | Dua blok stok tampil jelas: bahan (gudang) vs produk per kedai |

## M7 — Sesi, Blind Closing & Collect

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M7-1 | **Blind closing:** form tutup tidak menampilkan expected; server tidak mengirim `expected_cash`/`cash_difference` ke perangkat karyawan | M3-8, M3-9 | L | `app/pos/(kasir)/shift/actions.ts`, `tutup-toko-form.tsx` | Karyawan hanya melihat "tersimpan" setelah tutup; angka perbandingan nol di payload jawaban server. **Tambahan:** halaman shift POS tidak lagi menampilkan perkiraan kas (nilai itu = expected) |
| ✅ M7-2 | Sisa fisik per produk saat tutup (input buta) → `sisa_fisik` | M7-1 | M | migration + `components/pos/sisa-fisik-form.tsx` | Tiap produk sesi dihitung fisik; unique (`shift_id`,`product_id`); minimal stok yang tercatat > 0 |
| ✅ M7-3 | Catat waste (stok hilang sah) + alasan → ledger reason `waste` | M3-8 | M | RPC `record_waste` + form | `stock_movements` reason `waste` + baris `waste` (alasan wajib) dalam 1 transaction; idempoten per `waste.id` |
| ✅ M7-4 | Halaman **Collect** pemilik: setoran seharusnya, selisih kas, selisih stok per produk | M7-2, M3-10 | L | `app/admin/(dashboard)/collect/*`, `components/admin/collect-screen.tsx` | Hanya sesi `final` yang bisa di-collect; angka dari `shifts` + `sisa_fisik`; tampil `sesuai`/`tidak_sesuai`; karyawan tidak pernah melihat halaman ini. *Variasi: selisih = fisik − tercatat (tercatat di-rekonstruksi dari ledger, dipotong pergerakan setelah tutup), ditampilkan per produk dengan warna, bukan teks "sesuai/tidak_sesuai"* |
| ✅ M7-5 | Status selisih: `terbuka → dijelaskan / dicatat rugi` + catatan | M7-4 | M | `collect` + form pemilik | Sesi `tidak_sesuai` `terbuka` masuk halaman Perlu Perhatian sampai ditutup. *Variasi: penutupan status + notifikasi `selisih` (untuk `rugi`) & `shift_selesai` (saat tutup)* |
| ✅ M7-6 | Notifikasi in-app + halaman **Perlu Perhatian** (buka/tutup kedai, selisih, pending) | M7-4, M5-2 | M | tabel `notifikasi` + `app/admin/(dashboard)/perhatian/*` | Kejadian relevan menulis baris `notifikasi`; lonceng + daftar belum selesai di dashboard pemilik |

> M3-5 (absensi) sudah **dibuang** end-to-end: tabel `attendance` di-drop (migration 0014), halaman/aksi POS absensi + menu "Absen" dihapus. Riwayat shift & transaksi cukup untuk kebutuhan ritel klien Malaysia.

## M8 — Anti-Kecurangan Lanjutan (Fase 2)

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| ✅ M8-1 | Void → `perlu_review`: transaksi tidak langsung void, stok TIDAK otomatis kembali; keputusan pemilik | M7-4, M1-14 | L | migration 0015 (`void_request`, status `perlu_review`, RPC `request_void`/`decide_void`) + UI kasir (`riwayat`) & admin (`/admin/void`) | Mengubah invariant void lama; review di sisi pemilik; disetujui → void + stok balik via ledger + notifikasi; ditolak → kembali `completed` (alasan wajib). **18/18 uji lulus** (`supabase/tests/void-review.sql`), `constraints.sql` 30/30 tetap hijau, `schema-check.sql` memuat objek baru. *Variasi: `request_void` mensyaratkan shift terbuka; `decide_void` admin boleh untuk shift tertutup apa pun (void_transaction lama dipertahankan utuh); refund QRIS tidak ada karena klien Malaysia di luar scope Midtrans (M1-10/11)* |
| ✅ M8-2 | Retur stok kedai → gudang (via mutasi) dikonfirmasi pemilik | M6-5 | S | notifikasi `assign` pada `ajukanMutasi` | Retur = mutasi ke warehouse; tetap diblok barang belum tahu. *Mekanisme sudah ada sejak M4/M6; ditambahkan notifikasi ke pemilik saat karyawan mengajukan retur agar tidak menganggur* |
| ✅ M8-3 | Kas keluar terkait sesi → ikut perhitungan setoran | M7-4 | M | `expenses.shift_id` + `expenses.from_cash` (migration 0015), constraint `expenses_from_cash_requires_shift` (0016), form & tabel pengeluaran | `expected_cash` = opening + tunai − kas keluar (`from_cash`) milik sesi itu; laporan per sesi. **4/4 uji lulus** (`supabase/tests/kas-keluar.sql`). *Variasi: kolom `from_cash` di `expenses`, bukan tabel `kas_keluar` terpisah* |
| ✅ M8-4 | Laporan: ringkasan harian, selisih terbuka, rasio void per karyawan, perangkat belum sync | M5-*, M8-1 | M | migration 0017/0018 → RPC `report_harian` & `report_void_karyawan`; `/admin/laporan/harian`; section live di `/admin/perhatian`; notif `device_stale` saat tutup | Peringatan `device_stale`;

**10/10 uji lulus** (`supabase/tests/laporan-harian.sql`): omzet hanya `completed` (void/`perlu_review` dikeluarkan), kedai tanpa transaksi tetap muncul, selisih terbuka dari shift `final`+`terbuka`, rasio void = void/(completed+void) basis `employee_id` urut menurun (hanya karyawan ber-void), anon ditolak/authenticated diberi. `ringkasan harian` dipakai untuk kontrol void yang banyak. *Variasi: rasio-void awalnya dihitung dari `voided_by` di 0017 (selalu 100% — kumpulannya hanya baris void), diperbaiki di 0018 berbasis `employee_id`; `device_stale` didefinisikan live dari shift `closed` + `pending_sync` (`pending_sync_count>0`) karena tidak ada tabel `devices`* |

## M9 — Polish & Deploy Klien Pertama

| ID | Task | Dep | Size | Output | DoD |
|---|---|---|---|---|---|
| M9-1 | Audit UI menyeluruh vs `design_1.md` (warna, spacing, radius, shadow, ikon) | M8 selesai | L | Checklist terisi | Nol hex manual di komponen; nol gradient; ikon satu set (Lucide) |
| M9-2 | Audit aksesibilitas & ergonomi POS (kontras, tap target, operasi satu tangan) | M9-1 | M | Laporan audit | Kontras teks ≥ 4.5:1; semua tombol POS ≥ 44px |
| M9-3 | Setup Sentry (client + server) + tag `kedai_id` dan versi build | — | M | `sentry.*.config.ts` | Error uji muncul di Sentry lengkap dengan konteks kedai |
| M9-4 | Hardening: rate limit endpoint sync & QR login, validasi input (Zod) | M2-4, M3-4 | L | Middleware + skema Zod | Payload tidak valid ditolak sebelum menyentuh DB |
| 🟡 M9-5 | Dokumentasi provisioning instance baru (Supabase + Vercel + env + seed) | M0-6 | M | `docs/provisioning.md` | Runbook sudah ditulis; langkah bertanda 🔬 **belum diuji** sampai klien pilot. Perbarui setelah dijalankan sungguhan |
| M9-6 | Uji end-to-end: buka toko → produksi → assign → transaksi (online & offline) → tutup buta → collect | Semua | L | `docs/test-e2e.md` | Semua langkah lulus di HP fisik, bukan hanya emulator |
| M9-7 | Deploy instance pilot + serah terima & pelatihan singkat | M9-5, M9-6 | M | Instance produksi | Klien bisa transaksi mandiri di hari pertama |

---

## Jalur Kritis
`M0-1 → M0-6 → M0-8 → M1-8 → M1-9 → M2-3 → M2-4 → M4-2 → M5-2 → M6-4 → M7-4 → M8-1 → M9-6`

Untuk klien Malaysia, M1-10/11 (Midtrans QRIS) **out of scope**, M3-5 (absensi) **dibuang**, dan M6-7 export CSV tidak memblokir rilis. Alur rilisan inti baru: produksi → assign → sesi → blind closing → **collect**.

---

## Keputusan Desain yang Sudah Ditetapkan
Lima masalah ditemukan saat menelaah `Database.md`. Semuanya sudah diputuskan dan skemanya sudah diperbarui — bagian ini menyimpan **alasannya**, supaya keputusan tidak dibongkar ulang tanpa konteks.
(Keputusan adaptasi klien Malaysia ada di bagian kedua: **"Keputusan Desain — Adaptasi Klien Malaysia (M6–M8)"**.)

**1. FK polimorfik → dua kolom nullable + CHECK.**
`stock_mutations.requested_by` dan `expenses.recorded_by` semula ditulis "FK → employees.id **atau** admin_users.id". Postgres tidak bisa menegakkan satu kolom FK ke dua tabel. Alternatifnya (`actor_type` + `actor_id` tanpa FK) membuang integritas referensial demi kerapian kolom. Dipilih: `requested_by_employee_id` + `requested_by_admin_id`, keduanya nullable, dengan `CHECK num_nonnulls(...) = 1`. Query jadi sedikit lebih ribet, tapi data sampah tidak bisa masuk. → `Database.md` §9 & §12.

**2. `transaction_number` ditetapkan server, bukan device.**
Nomor urut per kedai per hari tidak mungkin dibuat di device: dua kasir offline bersamaan di kedai sama pasti bertabrakan, dan baru ketahuan saat sync — setelah nomornya terlanjur disebut ke pelanggan. Dipisah jadi `local_number` (device, sementara, ditandai "belum sync" di UI) dan `transaction_number` (server, final, urut per `business_date`). Konsekuensi yang diterima: urutan nomor final mengikuti waktu sampai di server, bukan waktu transaksi dibuat. → `Database.md` §10, task M1-9.

**3. Ditambahkan ledger `stock_movements`.**
Skema lama hanya menyimpan saldo, tanpa riwayat pergerakan — begitu stok fisik tidak cocok, tidak ada apa pun untuk ditelusuri. Ledger append-only ditambahkan sekarang karena menambahkannya setelah ada data produksi berarti saldo historis tidak bisa direkonstruksi lagi. Bonus penting: unique index `(ref_transaction_id, product_id, reason)` membuat idempotensi sync dijamin **database**, bukan bergantung pada logika aplikasi yang bisa keliru saat retry. → `Database.md` §8, task M4-2.

**4. Stok boleh minus.**
Kasir tetap bisa menjual walau stok tercatat nol. Alasannya: cache stok di HP bisa basi saat offline, dan menolak penjualan di kedai F&B lebih merugikan daripada angka stok yang minus sementara. Stok ≤ 0 ditandai badge `danger`, dikoreksi lewat `adjustment` di ledger (dengan alasan wajib), bukan lewat UPDATE langsung. → `Database.md` §7, task M4-2b.

**5. Shift boleh ditutup dengan antrian belum kosong.**
Mensyaratkan sync selesai sebelum tutup toko berarti internet mati = toko tidak bisa tutup. Diganti: shift ditutup dengan `reconciliation_status = pending_sync`, `expected_cash` diisi angka sementara, dan server menghitung ulang setiap kali transaksi shift itu masuk sampai statusnya `final`. UI menandai selisih yang belum final sebagai `warning`, bukan sebagai selisih kas sungguhan — supaya karyawan tidak dituduh salah hitung padahal datanya memang belum lengkap. → `Database.md` §4, task M3-9.

**6. Tetap Supabase, bukan Neon — untuk sekarang.**
Neon dipertimbangkan sebagai alternatif Postgres. Secara teknis sanggup, dan momen pindah paling murah memang sekarang (kopling Supabase saat ini cuma 3 env var + 3 paket npm + satu FK ke `auth.users`). Yang menahan bukan soal database: Supabase juga menyediakan Auth, Storage, dan Realtime, sehingga provisioning klien baru cukup **satu langkah**. Dengan Neon jadi empat layanan terpisah per klien — persis kompleksitas yang `Tech.md` ingin dihindari di awal.

Yang **tidak** terpengaruh kalau suatu saat pindah: login karyawan lewat QR (sudah custom sejak awal), RLS (fitur Postgres, bukan Supabase), dan seluruh mekanisme offline-first. Titik lock-in-nya hanya tiga: Auth, Storage, Realtime. Database-nya sendiri portabel lewat `pg_dump`.

Kelemahan nyata Supabase di sini bukan kemampuan teknis, tapi **biaya per project** yang naik linier terhadap jumlah klien. Jadwal evaluasi ulang: klien ke-3 atau ke-4, bukan sekarang. Detailnya di `provisioning.md` bagian "Catatan biaya".

---

## Keputusan Desain — Adaptasi Klien Malaysia (M6–M8)

Dari draft rancangan "Sistem Stok & Keuangan Kedai" (klien Malaysia), dipakai yang selaras dengan aturan yang sudah ditegakkan repo ini; yang bertabrakan dengan perilaku lama dicatat eksplisit di sini supaya tidak dibongkar diam-diam.

**7. Gudang pusat dimodelkan sebagai `kedai` dengan `is_warehouse = true`.**
Draft punya alur "stok jadi pusat → assign → stok kedai". Alih-alih membuat entitas lokasi baru beserta jejeran mekanisme (mutasi, approval, idempotensi), gudang cukup menjadi `kedai` biasa: `kedai_stock` dan `stock_mutations` terpakai apa adanya. Assign = mutasi dari warehouse; retur = mutasi ke warehouse. Warehouse tidak punya karyawan/transaksi/sesi — hanya menjadi sumber dan penampung stok.

**8. Bahan mentah punya ledgernya sendiri (`bahan_movement`).**
Stok mentah dan stok jadi adalah dua ledger terpisah karena tidak dipecah oleh satuan: satu bahan satu satuan (gram, bungkus, porsi), tanpa konversi. Invariant "saldo = jumlah semua pergerakan" berlaku untuk keduanya, dan koreksi bahan juga lewat ledger (reason `koreksi`, alasan wajib) — bukan UPDATE langsung.

**9. Produksi input manual tanpa resep baku.**
Draft menekankan "tidak ada resep baku; pemilik mengisi bahan yang dipakai". Berarti `produksi` + `produksi_bahan` mencatat apa yang terjadi per run, TANPA template/masters resep yang memaksa konsistensi. Konsistensi lintas run (kalau mau) jadi soal disiplin, bukan constraint DB.

**10. Blind closing.**
Angka `expected_cash`/`cash_difference` tidak pernah dikirim ke perangkat karyawan — baik saat input tutup maupun sesudahnya. Perbandingan hanya tampil di halaman **Collect** milik pemilik. Tujuan: karyawan tidak bisa menyesuaikan angka kas agar terlihat "pas". Ini mengubah perilaku M3-8 (yang menampilkan selisih ke kasir).

**11. Selisih stok dihitung tanpa snapshot stok awal.**
`selisih_stok = jumlah terjual tercatat − (stok tercatat saat tutup − sisa_fisik)`. Tidak perlu tabel snapshot `stok saat buka`: "hilang" = selisih antara ledger akhir dan fisik saat tutup, dengan `waste` sudah mengurangi stok tercatat sehingga tidak terhitung hilang.

**12. Void jadi `perlu_review` (M8-1) — mengubah invariant lama.**
Sebelumnya void otomatis mengembalikan stok (ledger `void`). Untuk klien anti-kecurangan, void diubah jadi butuh review pemilik dan **tidak** mengembalikan stok sampai disetujui. Ini sengaja dijadikan milestone terpisah (M8-1) karena mengganti invariant yang diuji 10/10 di M1-14.

**13. Tetap `numeric(12, 2)`, bukan integer sen.**
Draft memakai "bilangan bulat sen". Di PostgreSQL `numeric` sudah eksak (tidak ada bahaya floating point yang melatarbelakangi aturan "sen integer"), jadi mengubah seluruh kolom + laporan menjadi integer hanya menambah biaya tanpa keuntungan presisi. Label mata uang diganti RM (M6-0).

**14. Absensi dibuang.**
`attendance`, clock-in/out, dan halaman absensi dihapus. "Satu kedai satu karyawan" berarti pencatatan jam hadir tidak memberi nilai; yang penting hanya siapa yang buka/menutup sesi (`opened_by`/`closed_by`) untuk akuntabilitas.

**15. Notifikasi hanya di dalam aplikasi.**
Tidak ada push/Telegram/WhatsApp. Server menulis baris `notifikasi`; pemilik membacanya saat membuka aplikasi (lonceng + halaman Perlu Perhatian). Ini menunda butuh infrastruktur push sampai terbukti pemilik melewatkan laporan karena tidak membuka aplikasi.

**16. QRIS/Midtrans dihentikan untuk klien Malaysia (M1-10/11 ⛔).**
QRIS adalah standar pembayaran Indonesia (ekuivalen Malaysia: DuitNow), dan klien ini cash-only demi fokus anti-kecurangan kas. Kode + tabel `qris_payments` ditahan, bukan dihapus — menggantinya dengan DuitNow atau balik bekerja untuk klien Indonesia tidak perlu membangun ulang dari nol.

---

## Perubahan Dokumen Lain
- `Milestone.md` — referensi `design.md` diperbaiki jadi `design_1.md` (nama file sebenarnya), dan task turunan dari kelima keputusan di atas ditambahkan ke M0, M1, M3, M4.
- `Tech.md` — referensi `design.md` yang sama ikut diperbaiki.

---

## Penyimpangan dari Rencana Awal (dicatat saat implementasi)

**Tailwind v4 tidak memakai `tailwind.config.ts`.**
`Tech.md` dan rencana M0-2 awal mengasumsikan token warna didefinisikan di `tailwind.config`. `create-next-app` sekarang memasang Tailwind v4, yang konfigurasinya CSS-first: token ditulis di blok `@theme` dalam `app/globals.css` dan otomatis jadi utility class. Hasil akhirnya sama persis dengan yang diminta `design_1.md` — bahkan lebih dekat, karena doc memang meminta token ditulis sebagai CSS custom properties supaya dark mode bisa ditambahkan belakangan tanpa refactor.

**Tabrakan nama `text-primary`.**
`design_1.md` (versi lama) punya token warna brand `primary` **dan** token warna teks `text-primary`. Di Tailwind, class `text-primary` otomatis berarti "teks berwarna brand" — bertabrakan dengan maksud "warna teks utama". Di versi desain brutalism sekarang, tabrakan ini diselesaikan dengan menamai warna teks utama `ink`, jadi class-nya `text-ink`. Form yang canggung `text-text-primary` tidak lagi ada.

**Tema visual diganti ke Neo-Brutalism (putih/kuning).**
Arah desain awal (terracotta + radius lembut + shadow kabut) diganti total: `docs/design_1.md` sekarang ditulis ulang sebagai neo-brutalism — radius 0, border 2px hitam, shadow offset keras tanpa blur, warna solid tanpa gradient, tema putih/kuning (varian biru terdokumentasi sebagai ganti 5 token). Konsekuensi teknis yang tidak ada di rencana awal:

- Semua token `--radius-*` di-override ke 0 di `@theme`, jadi `rounded-*` yang terlupa tetap siku.
- Token semantik dapat pasangan versi gelap (`text-danger-text` dst.) karena warna solid `#ff4b3e`/`#3ddc84` tidak boleh jadi warna teks di atas putih (kontras < 2:1).
- Muncul utility `press-brutal` (translate 2px + shadow hilang saat `:active`) supaya tombol terasa merespons.
- Font kedua ditambahkan: Space Grotesk sebagai `--font-display` untuk heading (Plus Jakarta Sans tetap body).

**Font dipilih: Plus Jakarta Sans.**
`design_1.md` memberi opsi Space Grotesk atau Archivo untuk heading dan Plus Jakarta Sans untuk body. Dipilih Space Grotesk (display) + Plus Jakarta Sans (body). Catatan: jangan isi `weight` di `next/font/google` — Turbopack gagal resolve kalau satu query menghasilkan lebih dari satu file.

**Service worker tidak benar-benar "kosong".**
M0-11 awalnya menyebut "service worker kosong". Chrome tidak menganggap aplikasi installable kalau SW-nya tidak punya `fetch` handler yang tetap merespons saat offline, jadi SW diberi isi paling minimal: precache satu halaman `/offline` sebagai fallback navigasi. Request data (API/Supabase) sengaja **tidak** di-cache — untuk POS, stok basi yang menyamar jadi data valid lebih berbahaya daripada error jaringan yang terlihat jelas. Antrian transaksi offline tetap dikerjakan di M2 lewat IndexedDB, bukan di service worker.

**Route group `(admin)`/`(pos)` diganti segmen nyata `/admin/*` dan `/pos/*`.**
Rencana awal memakai route group Next (`app/(admin)`, `app/(pos)`). Masalahnya route group **tidak menambah segmen URL**, sehingga `app/(admin)/stok` dan `app/(pos)/stok` sama-sama menghasilkan `/stok` — bentrok, dan build gagal. Padahal M4-6 memang menuntut dua halaman stok yang berbeda (admin melihat semua kedai, kasir hanya kedainya sendiri).

Diganti jadi segmen nyata. Efek sampingnya menguntungkan: middleware auth jadi sepele (`/admin/*` pakai Supabase Auth, `/pos/*` pakai sesi QR karyawan) tanpa perlu mencocokkan daftar path satu per satu. `start_url` PWA juga bisa langsung menunjuk `/pos/kasir`.

**Penyimpanan transaksi ditulis sebagai fungsi database, bukan rangkaian query dari aplikasi.**
Satu penjualan menyentuh empat hal yang harus berhasil atau gagal bersama: header transaksi, item, saldo stok, dan ledger. Kalau dikerjakan sebagai query terpisah dari Next, kegagalan jaringan di tengah meninggalkan transaksi tanpa item, atau stok berkurang tanpa penjualan — dan di sistem kasir itu berarti uang dan barang tidak cocok tanpa cara memperbaikinya selain menebak.

Tiga keputusan di dalam fungsi itu:
- **Total dihitung ulang server** dari harga yang dikirim client. Client boleh menentukan harga (itu snapshot yang sudah disebutkan ke pelanggan), tapi tidak boleh menentukan totalnya — perangkat yang dimodifikasi bisa melaporkan total nol untuk sepuluh item.
- **Advisory lock** menyerialkan penomoran per kedai+tanggal. Tanpa itu dua transaksi yang tiba bersamaan membaca nomor tertinggi yang sama lalu bertabrakan di unique index.
- **`revoke execute` dari anon/authenticated.** PostgREST mengekspos setiap fungsi di schema public sebagai endpoint RPC. Tanpa pencabutan itu, siapa pun yang punya anon key bisa membuat transaksi palsu. Sudah diverifikasi: anon ditolak `42501`.

**Urutan M1 → M3 salah di rencana awal: transaksi tidak bisa disimpan sebelum ada shift.**
`Tasks.md` menempatkan M1-8 (simpan transaksi) hanya bergantung pada M1-7. Kenyataannya `transactions.shift_id` dan `transactions.employee_id` keduanya **NOT NULL**, jadi satu baris transaksi pun tidak bisa ditulis sebelum ada sesi karyawan (M3-4) dan shift terbuka (M3-6).

Ini bukan kekurangan skema — memang benar transaksi harus selalu melekat pada shift, kalau tidak rekonsiliasi kas kehilangan dasarnya. Yang salah urutan rencananya.

Akibatnya kelompok 06 (Kasir & Transaksi) dipecah: M1-6 dan M1-7 (grid + keranjang, murni baca data) dikerjakan lebih dulu; M1-8 dan seterusnya menunggu M3-4/M3-6.

**Sesi POS memakai cookie sendiri, bukan Supabase Auth.**
Karyawan login lewat QR, jadi tidak punya `auth.uid()`. `lib/pos/session.ts` menyimpan `{kedaiId, employeeId, ...}` di cookie httpOnly, dan HANYA `mulaiSesi()` yang menulisnya — setelah token dicocokkan ke `employees.qr_token`.

`kedaiId` diambil dari data karyawan, **tidak pernah dari input perangkat**. Kalau kedai ikut dikirim dari HP, satu kasir bisa mengaku bertugas di cabang lain dan transaksinya tercatat di kedai yang salah — baru ketahuan saat tutup buku.

Halaman `/pos/masuk` juga sengaja tidak memuat data apa pun dari database. Menampilkan daftar nama karyawan beserta cabangnya kepada orang yang belum terverifikasi tidak ada gunanya untuk kasir.

**File `"use server"` hanya boleh mengekspor fungsi async.**
Konstanta `TIMEZONES` sempat diekspor dari `actions.ts` yang ber-`"use server"`. Next mengubah setiap ekspor di file itu jadi referensi server action, jadi komponen client yang mengimpornya menerima sesuatu yang bukan array. Gejalanya di produksi: `TypeError: n is not iterable`, tanpa petunjuk apa pun ke penyebabnya.

**`npm run build` dan `npx tsc --noEmit` sama-sama lolos.** Hanya menjalankan halamannya yang menangkap ini. Konstanta bersama sekarang diletakkan di `lib/timezones.ts`.

**Otorisasi dipisah dua lapis: middleware ≠ gerbang.**
Middleware hanya memeriksa "ada sesi Supabase Auth", bukan "berhak". Pemeriksaan keanggotaan `admin_users` butuh query database, dan middleware jalan di setiap request — jadi itu diletakkan di layout `app/admin/(dashboard)/layout.tsx` lewat `requireAdmin()`. Karena di layout, setiap halaman di bawahnya otomatis terlindungi tanpa perlu mengulang pemeriksaan per halaman, pola yang paling gampang terlupa saat menambah halaman baru.

Redirect di middleware harus **membawa cookie sesi yang baru disegarkan**. `NextResponse.redirect()` polos membuang cookie itu dan user terjebak loop login — ditangani `redirectPreservingCookies()`.

**Halaman login dipisah dari layout dashboard lewat route group `(dashboard)`.**
Kalau `app/admin/login` mewarisi `app/admin/layout.tsx`, halaman login akan menampilkan sidebar admin lengkap ke orang yang belum login. Halaman terproteksi dipindah ke `app/admin/(dashboard)/`, yang tidak mengubah URL sama sekali. Ini tidak bertentangan dengan keputusan meninggalkan route group sebelumnya — masalah dulu adalah tabrakan URL `/stok` di root, bukan route group itu sendiri.

**RLS tidak bisa men-scope karyawan per kedai — dan itu memang tidak perlu.**
M0-10 semula berbunyi "karyawan discope `kedai_id`" dengan DoD "query lintas kedai dari sesi karyawan ditolak di level DB". Itu tidak mungkin: karyawan login lewat QR token, **bukan** Supabase Auth, jadi mereka tidak punya `auth.uid()` dan tidak akan pernah cocok dengan policy apa pun.

Modelnya diperjelas jadi:
- **RLS** = pertahanan terhadap anon key yang bocor ke browser. Tanpa policy untuk anon, nol baris terbaca. Ini yang diuji `supabase/tests/rls.sql`.
- **Pembatasan kedai untuk karyawan** = ditegakkan di server, karena seluruh akses POS lewat server action / route handler dengan service role. Aturan wajibnya ditulis di `lib/supabase/admin.ts`: setiap pemanggilan harus memfilter `kedai_id` eksplisit.

Uji yang paling penting bukan "admin bisa baca", melainkan **"user yang sudah login tapi tidak terdaftar di `admin_users` tetap dapat nol baris"**. Kalau policy hanya memeriksa `authenticated`, siapa pun yang berhasil mendaftar lewat Supabase Auth langsung punya akses penuh ke seluruh data bisnis klien. Sudah diverifikasi lewat dua jalur: SQL (`request.jwt.claims`) dan HTTP dengan JWT sungguhan.

**Helper RLS wajib `security definer` + `search_path` terkunci.**
Policy di `admin_users` memanggil `is_active_admin()`, yang query-nya membaca `admin_users` — tanpa `security definer` itu rekursi tak berujung. Dan `security definer` tanpa `set search_path` bisa dibajak lewat objek bernama sama di schema lain.

**Generate tipe tanpa Docker.**
`supabase gen types` menjalankan generator di dalam container, jadi Docker Desktop harus hidup tiap kali skema berubah. Diganti `scripts/gen-types.mjs` yang introspeksi lewat koneksi `pg` yang sudah ada. Bonus yang tidak diberikan generator resmi: kolom `text` + CHECK diterjemahkan jadi union literal (`"open" | "closed"`), bukan `string` longgar — typo seperti `"complete"` alih-alih `"completed"` sekarang gagal saat compile, bukan saat runtime.

**Koneksi database wajib lewat Session pooler, bukan Direct connection.**
Host direct Supabase (`db.<ref>.supabase.co`) sekarang hanya punya record IPv6. Dari koneksi tanpa rute IPv6 — umum di Indonesia — hasilnya `getaddrinfo ENOTFOUND`, bukan pesan yang mengarahkan ke akar masalah. Yang dipakai: `aws-0-ap-southeast-1.pooler.supabase.com:5432` dengan user `postgres.<ref>` (perhatikan usernya berbeda dari direct connection). Ini perlu diulang di tiap provisioning klien baru, jadi sudah masuk `provisioning.md`.

**Akses SQL lewat `pg`, bukan REST.**
Verifikasi constraint, seed, dan uji skema tidak bisa dilakukan lewat PostgREST — endpoint-nya tidak mengekspos `information_schema` dan tidak bisa membuka transaction yang di-rollback. Ditambahkan `pg` sebagai devDependency plus runner `npm run db`. Ini juga yang membuat uji constraint bisa transaksional: 30 uji berjalan lalu ROLLBACK, database tidak berubah sama sekali.

**Jangan isi `metadata.icons` di `app/layout.tsx`.**
Mengisi field `icons` secara manual membuat Next mengabaikan konvensi file — favicon dari `app/icon.svg` hilang diam-diam tanpa error. Favicon dan apple-touch-icon sekarang murni lewat konvensi file (`app/icon.svg`, `app/apple-icon.png`).
