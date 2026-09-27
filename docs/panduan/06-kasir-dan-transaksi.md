# 06 — Kasir & Transaksi

Mencakup **M1-6** (grid produk), **M1-7** (keranjang), **M1-8** (simpan), **M1-9** (penomoran), **M1-12** (konfirmasi sukses), **M1-13** (riwayat), **M1-14** (void). Termasuk juga **M3-4** (sesi QR) dan **M3-6** (buka toko), karena tanpa keduanya transaksi tidak bisa disimpan sama sekali.

## Apa Ini

Alur jual sehari-hari di kedai: kasir masuk dengan kartu QR, membuka toko, memilih produk, menerima pembayaran tunai, dan bisa membatalkan transaksi yang salah.

Ini inti sistemnya. Modul lain melayani modul ini.

## Alur Lengkap

```
Scan kartu QR          → /pos/masuk   → sesi (kedai + karyawan) di cookie
Input kas awal         → /pos/shift   → shift terbuka
Pilih produk → bayar   → /pos/kasir   → transaksi tersimpan, stok berkurang
Salah? batalkan        → /pos/riwayat → status void, stok dikembalikan
```

Tiap anak panah melewati satu gerbang. Kalau sesi tidak ada, layout POS mengalihkan ke `/pos/masuk`. Kalau shift tidak terbuka, tombol bayar menolak dengan pesan jelas.

## Kenapa Transaksi Butuh Shift

`transactions.shift_id` bertipe **NOT NULL**. Bukan kelalaian — setiap penjualan harus melekat pada satu shift, kalau tidak rekonsiliasi kas saat tutup toko kehilangan dasarnya: tidak ada cara tahu uang mana yang seharusnya ada di laci.

Konsekuensinya untuk urutan pengerjaan: M1-8 **tidak bisa** dikerjakan sebelum M3-4 dan M3-6, meski `docs/Tasks.md` awalnya menempatkannya lebih dulu.

## Sesi Kasir (M3-4)

Karyawan **bukan** user Supabase Auth. Mereka masuk dengan kartu QR, dan sesinya disimpan di cookie httpOnly oleh `lib/pos/session.ts`.

```ts
// app/pos/actions.ts
const { data: employee } = await db
  .from("employees")
  .select("id, name, is_active, kedai:kedai_id (id, name, is_active)")
  .eq("qr_token", token)
  .maybeSingle();
```

Aturan yang tidak boleh dilanggar: **`kedai_id` diambil dari data karyawan, tidak pernah dari input perangkat.** Kalau kedai ikut dikirim dari HP, satu kasir bisa mengaku bertugas di cabang lain — dan transaksinya tercatat di kedai yang salah, baru ketahuan saat tutup buku.

Dua detail keamanan lain:

- Pesan gagal tidak membedakan "token tidak ada" dan "karyawan nonaktif". Membedakannya memberi tahu penebak bahwa sebuah token itu valid.
- Halaman `/pos/masuk` tidak memuat data apa pun dari database. Halaman itu bisa diakses siapa saja; menampilkan daftar nama karyawan beserta cabangnya tidak ada gunanya untuk kasir.

### Kamera QR

`components/pos/qr-scanner.tsx` memakai `html5-qrcode`, diimpor **dinamis** dan hanya saat kamera dinyalakan — ukurannya ~0,5 MB dan kasir yang mengetik kode manual tidak membutuhkannya.

> **Belum diuji di perangkat nyata.** Jalur kamera butuh HTTPS dan izin kamera, tidak bisa diverifikasi dari baris perintah. Masukan manual adalah jalur yang sudah teruji, dan sengaja dipertahankan sebagai cadangan permanen — kamera HP bisa rusak atau izinnya ditolak di tengah shift, dan kasir tidak boleh berhenti berjualan karena itu.

## Buka Toko (M3-6)

Kas awal dihitung fisik, lalu shift dibuka. Shift kedua di kedai yang sama ditolak *partial unique index* `shifts_one_open_per_kedai`, bukan oleh pengecekan di kode:

```ts
if (error.code === "23505") {
  return { error: "Kedai ini sudah punya shift yang terbuka. ..." };
}
```

### `business_date` memakai zona waktu kedai

```ts
// lib/pos/shift.ts
export function businessDate(timezone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(at);
}
```

Server berjalan di UTC. Kalau kasir di Jakarta bertransaksi jam 00:30, tanggal UTC masih hari kemarin — dan penjualan itu masuk laporan hari yang salah.

Sudah diuji 6 kasus lintas WIB/WITA/WIT; 3 di antaranya akan salah kalau memakai tanggal server.

## Grid Produk & Keranjang (M1-6, M1-7)

Grid 2 kolom di HP, dengan search dan filter kategori. Stok ditampilkan sebagai **informasi, bukan penghalang** — kasir tetap boleh menjual saat stok nol atau minus (lihat `docs/Database.md` §7).

Grid jadi **1 kolom** kalau QRIS tidak aktif. Alasannya tombol **Bayar QRIS** diisi per lebar layar: dengan QRIS ada, tiap tombol jadi terlalu sempit untuk dibaca. Penentuannya `qrisAktif`, yaitu `MIDTRANS_AKTIF` yang dihitung server dari `MIDTRANS_SERVER_KEY` lalu diteruskan ke komponen — jadi status QRIS tidak pernah bocor ke bundle client. Lihat [12 QRIS](12-qris-pembayaran.md).

Logika keranjang dipisah ke `lib/pos/cart.ts`, bukan di dalam komponen:

```ts
export function reducerKeranjang(state: Keranjang, aksi: AksiKeranjang): Keranjang
export function totalItem(keranjang: Keranjang): number
export function totalHarga(keranjang: Keranjang): number
```

Alasannya konkret: M2 akan memindahkan keranjang ke IndexedDB, dan pemisahan ini berarti perpindahan itu tidak menyentuh tampilan sama sekali.

**Harga di-snapshot saat produk masuk keranjang**, bukan dibaca ulang saat checkout. Kalau admin mengubah harga di tengah transaksi, pelanggan tetap membayar angka yang tadi disebutkan kasir.

## Menyimpan Transaksi (M1-8)

Satu penjualan menyentuh **empat** hal yang harus berhasil atau gagal bersama:

1. baris `transactions` (+ nomor urut final)
2. baris `transaction_items`
3. saldo `kedai_stock`
4. baris `stock_movements` (ledger)

Kalau dikerjakan sebagai query terpisah dari Next, kegagalan jaringan di tengah meninggalkan transaksi tanpa item, atau stok berkurang tanpa penjualan. Di sistem kasir itu berarti uang dan barang tidak cocok — tanpa cara memperbaikinya selain menebak.

Karena itu semuanya masuk ke satu fungsi database: `supabase/migrations/0004_create_transaction.sql`.

### Yang dikerjakan server action

`app/pos/(kasir)/kasir/actions.ts` hanya mengurus apa yang tidak boleh dipercayakan ke perangkat:

```ts
const session = await getPosSession();        // kedai + karyawan dari sesi
const shift = await getOpenShift(session.kedaiId);
if (!shift) return { error: "Toko belum dibuka. ..." };

await db.rpc("create_transaction", {
  p_id: parsed.data.id,                       // dari client -- disengaja
  p_kedai_id: session.kedaiId,                // dari sesi
  p_employee_id: session.employeeId,          // dari sesi
  p_shift_id: shift.id,                       // dari database
  ...
});
```

`id` transaksi memang datang dari client. Itu **disengaja**: transaksi yang dibuat offline harus sudah punya identitas sebelum menyentuh server, dan identitas itulah yang membuat pengiriman ulang tetap idempoten.

### Total dihitung ulang di server

Client boleh menentukan harga — itu snapshot yang sudah disebutkan ke pelanggan. Tapi **tidak boleh** menentukan totalnya:

```sql
for v_item in select * from jsonb_array_elements(p_items) loop
  v_total := v_total + (v_item->>'price')::numeric * (v_item->>'qty')::integer;
end loop;
```

Tanpa ini, perangkat yang dimodifikasi bisa melaporkan total nol untuk sepuluh item.

### Idempotensi

Langkah pertama fungsi: kalau transaksi dengan `p_id` itu sudah ada, kembalikan nomornya dan berhenti. Bukan error — antrian offline memang mengirim ulang.

Lapis keduanya di database: unique index `movements_once_per_transaction` pada `(ref_transaction_id, product_id, reason)`. Kalau pengecekan pertama entah bagaimana terlewat, stok tetap tidak bisa berkurang dua kali.

## Penomoran Dua Lapis (M1-9)

| | Dibuat oleh | Contoh | Kapan dipakai |
|---|---|---|---|
| `local_number` | Perangkat | `OFF-A1B2-0007` | Rujukan sementara, sebelum sampai server |
| `transaction_number` | Server | `1`, `2`, `3` | Nomor resmi, urut per kedai per hari |

Nomor urut per hari **tidak mungkin** dibuat di perangkat: dua kasir yang offline bersamaan di kedai yang sama pasti menghasilkan urutan identik, dan tabrakannya baru ketahuan saat sync — setelah nomornya terlanjur disebut ke pelanggan.

Penomoran server diserialkan dengan advisory lock:

```sql
perform pg_advisory_xact_lock(hashtext(p_kedai_id::text || v_business_date::text));
```

Lock-nya hanya untuk kombinasi kedai+tanggal itu, jadi kedai lain tidak ikut menunggu. Dilepas otomatis saat transaksi selesai. Tanpa lock, dua transaksi yang tiba bersamaan membaca nomor tertinggi yang sama lalu bertabrakan di unique index.

## Riwayat (M1-13)

`/pos/riwayat` menampilkan transaksi hari itu, bisa difilter tanggal.

Query-nya memakai **service role** (karyawan tidak punya sesi Auth), jadi filter `kedai_id` wajib ditulis eksplisit:

```ts
.eq("kedai_id", session.kedaiId)
.eq("business_date", tanggal)
```

Tanpa itu, kasir kedai A akan melihat transaksi kedai B — dan tidak ada error apa pun yang memberi tahu.

Daftar menampilkan `transaction_number` kalau sudah ada, dan `local_number` dengan badge "Belum sync" kalau belum. Kondisi kedua akan sering terjadi setelah M2.

## Void (M1-14)

Membatalkan = tandai `void` + tulis movement **pembalik**. Bukan `DELETE`.

```
sale -2 (saldo 38) | sale -1 (saldo 39) | void +2 (saldo 40) | void +1 (saldo 40)
```

Baris `sale` tidak pernah dihapus. Laporan omzet harus bisa direkonstruksi kapan saja, dan data yang sudah dihapus tidak bisa diaudit. Transaksi yang salah tetap tercatat, beserta fakta bahwa ia dibatalkan, oleh siapa, kapan.

### Hanya shift yang masih terbuka

```sql
if v_status <> 'open' then
  raise exception 'Transaksi ini dari shift yang sudah ditutup. Pembatalan harus lewat admin.';
end if;
```

Membatalkan transaksi dari shift yang sudah ditutup mengubah `expected_cash` shift itu **secara surut** — selisih kas yang sudah ditandatangani jadi tidak cocok lagi, dan tidak ada yang tahu kenapa.

### Kedai lain ditolak

Fungsi memfilter `kedai_id` sendiri, tidak mengandalkan pemanggilnya. Satu kedai tidak bisa membatalkan transaksi kedai lain bahkan kalau id-nya ditebak dengan benar.

## Keamanan RPC — jangan dilewat

PostgREST mengekspos **setiap** fungsi di schema `public` sebagai endpoint RPC. Tanpa pencabutan izin, siapa pun yang punya anon key — dan anon key selalu bocor, ia dikirim ke browser — bisa membuat atau membatalkan transaksi.

```sql
revoke all on function public.create_transaction(...) from public, anon, authenticated;
revoke all on function public.void_transaction(...)   from public, anon, authenticated;
```

Sudah diverifikasi: anon ditolak `42501`, dan hanya `postgres` + `service_role` yang punya EXECUTE.

**Setiap fungsi baru yang kamu tambahkan wajib mengikuti pola ini.**

## Cara Menguji

```bash
npm run db -- supabase/tests/transaction.sql   # 12/12
npm run db -- supabase/tests/void.sql          # 10/10
```

Keduanya transaksional + rollback, aman dijalankan kapan saja.

Uji manual di browser:

1. `/pos/masuk` → kode `DEV-QR-RINA-0001` (dari seed)
2. `/pos/shift` → buka toko, kas awal 500000
3. `/pos/kasir` → pilih produk, Bayar Tunai → muncul nomor transaksi
4. `/pos/riwayat` → buka transaksinya → Batalkan → cek stok kembali

Langkah 2 memakai Melati karena seed dev sengaja **tidak** meninggalkan shift
terbuka di Melati — jadi "Buka Toko" selalu bisa langsung dicoba. Kalau kamu
masuk sebagai kasir Kenanga (Sari, `DEV-QR-SARI-0003`), shift Kenanga sudah
terbuka dari seed, jadi tombol "Buka Toko" akan ditolak. Tutup dulu lewat
`/pos/shift` kalau mau mencobanya.

Cek ledger:

```bash
npm run db -- -e "select reason, delta, balance_after from stock_movements order by created_at desc limit 10"
```

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| "Toko belum dibuka" saat bayar | Belum ada shift `open` di kedai itu | Buka toko di `/pos/shift` |
| "Kedai ini sudah punya shift yang terbuka" | Partial unique index bekerja | Muat ulang; shift lama masih berjalan |
| "Kartu tidak dikenali" | Token salah, atau karyawan/kedai nonaktif | `npm run db -- -e "select name, qr_token, is_active from employees"` |
| "Transaksi ini dari shift yang sudah ditutup" | Aturan void by design | Koreksi harus lewat admin |
| Stok berkurang dua kali | Seharusnya tidak mungkin | Jalankan `supabase/tests/transaction.sql`; kalau uji 8 gagal, unique index ledger hilang |
| `permission denied for function` | RPC dipanggil dengan anon key | Pastikan memakai `createAdminClient()` di server |
| Nomor transaksi bentrok | Advisory lock hilang dari fungsi | Bandingkan dengan `0004_create_transaction.sql` |

## Istilah

- **Advisory lock** — kunci sementara di Postgres yang tidak terikat tabel; dipakai menyerialkan operasi yang tidak bisa dijaga constraint.
- **Idempoten** — dijalankan berkali-kali hasilnya sama seperti sekali.
- **RPC** — memanggil fungsi database lewat HTTP, `supabase.rpc("nama", {...})`.
- **Snapshot harga** — harga disalin ke transaksi saat penjualan, supaya perubahan katalog tidak mengubah riwayat.
- **Movement pembalik** — baris ledger berlawanan arah yang membatalkan efek baris sebelumnya, tanpa menghapusnya.
