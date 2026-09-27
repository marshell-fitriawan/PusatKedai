# 02 — Database

## Apa Ini

Skema PostgreSQL 12 tabel di Supabase, beserta perkakas untuk menjalankan migration, mengisi data contoh, menguji aturan-aturannya, dan membuat tipe TypeScript-nya.

Rancangan lengkap beserta alasannya ada di `docs/Database.md`. Dokumen ini membahas **cara bekerja dengan database itu sehari-hari**.

## Prinsip yang Wajib Dipahami Dulu

Tiga aturan ini bukan preferensi gaya. Melanggarnya menghasilkan data rusak yang baru ketahuan berminggu-minggu kemudian, saat uangnya sudah tidak cocok.

### 1. Stok tidak pernah di-UPDATE langsung

Setiap perubahan stok **wajib** disertai satu baris di tabel `stock_movements`, dalam transaksi database yang sama.

```sql
-- SALAH: saldo berubah tapi tidak ada jejaknya
update kedai_stock set quantity = quantity - 1 where ...;

-- BENAR: saldo + catatan, sekali jalan
-- (dibungkus BEGIN...COMMIT, lihat contoh di supabase/seed.sql)
update kedai_stock set quantity = quantity - 1 where ...;
insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, ref_transaction_id)
values (..., -1, 39, 'sale', ...);
```

**Kenapa:** `kedai_stock.quantity` hanya menyimpan angka sekarang. Kalau stok fisik di kedai tidak cocok dengan catatan, tanpa `stock_movements` tidak ada apa pun untuk ditelusuri — kamu tidak akan pernah tahu barangnya hilang kapan, karena apa, atau siapa yang mencatatnya.

Istilahnya **ledger**: buku besar yang hanya bisa ditambah, tidak pernah diedit atau dihapus.

### 2. Transaksi tidak pernah dihapus

Membatalkan transaksi = ubah `status` jadi `'void'` + tulis movement pembalik. Bukan `DELETE`.

**Kenapa:** laporan omzet harus bisa direkonstruksi kapan saja. Data yang sudah dihapus tidak bisa diaudit.

### 3. Stok boleh minus

Tidak ada aturan yang melarang `quantity` negatif. Ini **disengaja**.

**Kenapa:** kasir bisa sedang offline dengan data stok yang sudah basi. Menolak penjualan karena catatan bilang stok habis lebih merugikan bisnis F&B daripada membiarkan angkanya minus lalu dikoreksi. Stok ≤ 0 ditandai badge merah di UI, dikoreksi lewat `stock_movements` dengan `reason = 'adjustment'`.

## Perkakas

Semua lewat npm script. Kredensial dibaca dari `.env.local` otomatis.

```bash
# Jalankan file SQL
npm run db -- supabase/tests/constraints.sql

# Query cepat
npm run db -- -e "select count(*) from kedai"

# Isi ulang data contoh (MENGHAPUS SEMUA DATA)
npm run seed

# Regenerate tipe TypeScript dari skema
npm run gen:types

# Terapkan migration baru
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

## Migration

File SQL di `supabase/migrations/`, dijalankan berurutan berdasarkan nama.

| File | Isi |
|---|---|
| `0001_init.sql` | 12 tabel, index, constraint |
| `0002_rls.sql` | Row Level Security (lihat panduan 03) |

Menambah perubahan skema:

1. Buat file baru, mis. `0003_tambah_kolom_x.sql`
2. `npx supabase db push --db-url "$SUPABASE_DB_URL"`
3. **`npm run gen:types`** — tipe TypeScript tidak ikut berubah sendiri
4. `npm run db -- supabase/tests/schema-check.sql` untuk memastikan tidak ada yang tertinggal

**Jangan pernah mengedit file migration yang sudah dijalankan.** Buat file baru. Migration yang sudah diterapkan tercatat di riwayat; mengeditnya membuat database dev dan database klien tidak lagi sinkron.

### Wajib: pakai Session pooler, bukan Direct connection

Di dashboard Supabase ada beberapa pilihan connection string. **Pilih "Session pooler".**

Direct connection (`db.<ref>.supabase.co`) sekarang hanya punya alamat IPv6. Dari koneksi internet Indonesia yang umumnya belum IPv6, hasilnya:

```
failed to connect: getaddrinfo ENOTFOUND db.xxxx.supabase.co
```

Pesan itu terlihat seperti salah ketik host, padahal masalahnya jaringan. Session pooler kompatibel IPv4:

```
postgresql://postgres.<ref>:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

Perhatikan usernya `postgres.<ref>`, **bukan** `postgres`. Ini beda antara pooler dan direct, dan sering terlewat saat menyalin.

## Seed

```bash
npm run seed
```

Mengisi: 3 kedai (Melati, Kenanga, Gudang Pusat), 2 akun admin, 3 karyawan, 10 produk F&B, 5 bahan baku, 3 produksi, 11 pengeluaran, dan 14 hari transaksi tunai. Histori dan data "menunggu tindakan" sengaja disiapkan supaya dashboard, laporan, dan halaman Perhatian langsung berisi tanpa setup manual.

Akun admin dev — keduanya masuk lewat `/admin/login`: **owner** `owner@kedaidev.test` / `dev-owner-2026`; **admin pusat** `admin@kedaidev.test` / `dev-admin-2026`.

Dua hal yang perlu diketahui:

**Seed melakukan TRUNCATE** — semua data operasional dihapus lebih dulu. Ada pengaman: skrip menolak jalan kalau tabel `transactions` sudah berisi data. Paksa dengan `npm run seed -- --force` hanya kalau kamu yakin itu database development.

**Seed membuat user Supabase Auth lebih dulu**, baru mengisi tabel. Ini karena `admin_users.id` harus sama persis dengan id user di sistem Auth. Urutan itu tidak bisa dibalik.

Produk "Pisang Goreng" sengaja distok hanya 3 supaya indikator "stok menipis" bisa langsung diuji tanpa perlu setup tambahan. Melati sengaja dibiarkan tanpa shift terbuka hari ini, jadi alur "Buka Toko" masih bisa didemokan; Kenanga justru dibiarkan terbuka supaya ada satu pengajuan void yang menunggu keputusan.

### Seed alternatif: `seed:minggu`

```bash
npm run seed:minggu
```

`supabase/seed-minggu.sql` menyimpan dataset yang lebih besar dan berbeda: kedai Nusantara, karyawannya sendiri, dan riwayat transaksi yang lebih panjang. Seed utama `seed.sql` yang dipakai demo klien karena id Melati/Kenanga/Rina/Budi/Sari-nya jadi acuan bersama untuk dokumentasi dan uji. Jangan campur keduanya dalam satu DB dev, karena seed terakhir yang dijalankan menimpa yang sebelumnya.

## Uji Database

Seluruh file uji di `supabase/tests/` berjalan dalam transaksi lalu **rollback** — jadi aman dijalankan kapan saja, data tidak berubah. Jalankan semuanya lewat `npm run db`:

```bash
npm run db -- supabase/tests/schema-check.sql   # deteksi drift   → harus 0 baris
npm run db -- supabase/tests/constraints.sql    # uji constraint  → 30/30
npm run db -- supabase/tests/rls.sql            # uji RLS         → 4/4
npm run db -- supabase/tests/transaction.sql    # simpan transaksi
npm run db -- supabase/tests/void.sql           # void lama (langsung)
npm run db -- supabase/tests/void-review.sql    # void perlu_review
npm run db -- supabase/tests/shift.sql          # buka/tutup + rekonsiliasi
npm run db -- supabase/tests/kas-keluar.sql     # pengeluaran dari kas
npm run db -- supabase/tests/stok.sql           # penyesuaian stok manual
npm run db -- supabase/tests/mutasi.sql         # perpindahan stok antar kedai
npm run db -- supabase/tests/laporan.sql        # laporan agregasi
npm run db -- supabase/tests/laporan-harian.sql # ringkasan harian & void
npm run db -- supabase/tests/qris.sql           # pembayaran QRIS
```

Beberapa uji memakai UUID id-id yang sama dengan `seed.sql` (kedai Melati/Kenanga, kasir Rina/Budi/Sari, produk contoh). Saat dev DB di-seed dengan `seed:minggu`, entitas itu tidak ada. Fixture bersama `supabase/tests/_fixtures.sql` dimuat otomatis oleh `scripts/db.mjs` pada baris `-- @include _fixtures.sql` di dalam masing-masing file — masih dalam transaksi yang sama, jadi ikut rollback. Idempoten (`ON CONFLICT DO NOTHING`), jadi juga aman terhadap DB yang sudah ber-seed penuh.

Fixture itu juga menutup dulu shift yang masih terbuka di kedua kedai kanonik. Alasannya index `shifts_one_open_per_kedai` hanya mengizinkan satu shift open per kedai: tanpa penutup itu, setiap uji yang membuat shift open akan ditolak karena shift open milik seed — bukan karena logikanya sendiri. Uji jadi tidak bergantung pada isi DB saat dijalankan.

> **Jangan jalankan test DB dengan psql langsung.** Penanda `-- @include _fixtures.sql` hanya diproses oleh `npm run db`. Pakai perintah di atas.

### `schema-check.sql` — deteksi drift

Memeriksa apakah semua constraint dan index yang ditulis di migration benar-benar ada di database. Outputnya **kosong = sempurna**; setiap baris yang muncul adalah yang hilang.

Kenapa ini perlu: kalau seseorang menjalankan SQL manual lewat SQL Editor dan ada bagian yang gagal di tengah, kolomnya bisa lengkap semua sementara constraint-nya diam-diam tertinggal. Yang tertinggal itu justru bagian yang menjaga data tetap benar.

### `constraints.sql` — buktikan aturannya bekerja

30 uji. Sebagian besar mencoba memasukkan data yang **seharusnya ditolak**, lalu memastikan database memang menolaknya.

Dua yang paling penting:

| Uji | Kalau gagal, akibatnya |
|---|---|
| Movement `sale` dobel ditolak | Kirim ulang antrian offline mengurangi stok dua kali |
| Movement `mutation` dobel ditolak | Klik approve dua kali memindahkan stok dua kali |

Keduanya dijaga *unique index* di database, bukan pengecekan di kode aplikasi. Alasannya: jalur retry/offline adalah tempat paling rawan logika aplikasi keliru, dan database tidak bisa dibujuk.

> **Idempoten** = operasi yang kalau dijalankan berkali-kali hasilnya sama seperti sekali. Wajib untuk sync offline, karena pengiriman ulang tidak bisa dihindari.

Ada juga dua uji **positif** — memastikan yang sengaja diizinkan tidak ikut terblokir: shift terbuka di kedai berbeda, dan stok negatif.

## Tipe TypeScript

```bash
npm run gen:types
```

Menghasilkan `lib/database.types.ts` dari skema yang sedang berjalan. Pemakaiannya:

```ts
import type { Tables, TablesInsert } from "@/lib/database.types";

type Kedai = Tables<"kedai">;              // bentuk baris hasil SELECT
type KedaiBaru = TablesInsert<"kedai">;    // bentuk data untuk INSERT
```

### Kolom status jadi union, bukan string

Karena skema memakai `text` + CHECK (bukan tipe ENUM Postgres), generator membaca daftar nilai dari CHECK-nya:

```ts
status: "open" | "closed"
reason: "initial" | "sale" | "void" | "mutation_out" | "mutation_in" | "adjustment"
```

Efeknya: salah ketik ketahuan saat compile.

```ts
await db.from("transactions").update({ status: "complete" })
//                                             ^^^^^^^^^^ error TS
//                                             harusnya "completed"
```

Tanpa ini, typo baru ketahuan saat database menolaknya di runtime — bisa jadi di HP kasir, saat ada antrian pelanggan.

### Kenapa tidak pakai `supabase gen types`

Perintah resmi itu menjalankan generator di dalam container Docker, jadi Docker Desktop harus hidup setiap kali skema berubah. `scripts/gen-types.mjs` membaca skema langsung lewat koneksi database biasa — tidak butuh Docker sama sekali.

**Ingat menjalankannya setiap kali ada migration baru.** Tipe tidak ikut berubah sendiri, dan tipe yang basi lebih berbahaya daripada tidak ada tipe.

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| `getaddrinfo ENOTFOUND db.xxx.supabase.co` | Pakai Direct connection (IPv6-only) | Ganti ke Session pooler di `.env.local` |
| `relation "kedai" already exists` | Migration pernah dijalankan manual, riwayatnya tidak tercatat | `npx supabase migration repair --status applied 0001 --db-url "$SUPABASE_DB_URL"` |
| Query mengembalikan `[]` padahal data ada | RLS memblokir — lihat panduan 03 | Cek apakah pakai client yang benar |
| Tipe TS tidak cocok dengan kolom baru | Lupa regenerate | `npm run gen:types` |
| `SUPABASE_DB_URL kosong` | `.env.local` belum diisi | Salin dari `.env.example` |
| Seed menolak jalan | Tabel `transactions` sudah berisi data | Pastikan ini DB dev, lalu `npm run seed -- --force` |

## Istilah

- **Migration** — file SQL berisi perubahan skema, dijalankan berurutan dan tercatat riwayatnya.
- **Constraint** — aturan yang ditegakkan database, mis. "kolom ini tidak boleh kosong".
- **Ledger** — tabel yang hanya bertambah, tidak pernah diedit/dihapus. Di sini `stock_movements`.
- **Idempoten** — dijalankan berkali-kali hasilnya sama seperti sekali.
- **Drift** — kondisi database asli tidak lagi sama dengan yang tertulis di migration.
- **Rollback** — membatalkan semua perubahan dalam satu transaksi, seolah tidak pernah terjadi.
- **Seed** — data contoh untuk development.
