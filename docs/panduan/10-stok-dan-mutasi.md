# 10 — Stok & Mutasi Antar Kedai

Mencakup **M4-1** (katalog stok per kedai), **M4-2 + M4-2b + M4-2c** (atur stok, badge menipis/habis, riwayat pergerakan), **M4-3** (daftar stok di POS), **M4-4** (persetujuan mutasi admin), **M4-5** (fungsi database `approve_mutation`), **M4-6** (pengajuan mutasi dari POS).

## Apa Ini

Setiap kedai punya saldo stok per produk (`kedai_stok`). Admin pusat bisa mengisi dan memperbaiki saldo; kasir melihat saldo kedainya sendiri; dan kalau barang harus pindah dari Kedai A ke Kedai B, kasir A mengajukan, admin pusat menyetujui, stok pindah — semuanya tercatat di ledger.

Ledger (`stock_movements`) adalah sumber kebenaran. `kedai_stock.quantity` hanyalah pencerminan terakhir dari ledger itu.

## Kenapa Ledger Itu Non-Negoti (reminder)

Aturan inti (ditetapkan `docs/Database.md` §7 dan ditegakkan di migration 0001):

> `kedai_stock.quantity` **tidak pernah** diubah langsung. Setiap perubahan wajib menemani satu baris `stock_movements` (alasan, delta, saldo setelah) dalam satu transaksi database.

Penyetel stok admin lewat `adjust_stock` (migration 0007). Penjualan/void lewat `create_transaction`/`void_transaction`. Mutasi antar kedai — yang baru di dokumen ini — lewat `approve_mutation` (migration 0009).

Kalau aturan ini dilanggar sekali saja, tidak ada cara menelusuri kenapa saldo berubah, dan selisih yang baru ketahuan berbulan-bulan nanti tidak bisa diaudit.

## Halaman Stok Admin (M4-1, M4-2)

`/admin/stok` = katalog produk bersama + saldo per kedai.

Pilihan kedai via `?kedai=` di query string (kedai yang dipilih terakhir tetap diingat dalam URL). Dua keputusan yang gampang dilupakan:

1. **Produk yang belum punya baris stok tetap tampil dengan 0** (badge "belum diatur"). Kalau disembunyikan, admin tidak punya cara mengisi stok awal produk baru.
2. **Stok boleh minus dan tetap bisa dijual** (lihat `docs/Database.md` §7). Badge dibedakan: habis (0), minus (<0), menipis (≤ `kedai.low_stock_threshold`), aman.

Set stok memakai modal dengan sebab **wajib diisi** (`note` minimal 3 karakter). Nilai itu yang akan dibaca orang lain enam bulan lagi ketika bertanya "kenapa saldo ini berubah?" — dan tabel riwayat (`riwayatStok`) menampilkannya.

## Adjust Stok: Kenapa lewat Fungsi (M4-2)

`setStok` server action memanggil RPC `adjust_stock`:

```ts
await db.rpc("adjust_stock", {
  p_kedai_id, p_product_id, p_new_quantity: quantity, p_note: note, p_admin_id: admin.id,
});
```

Pencatat (`created_by_admin_id`) diambil dari **sesi admin**, bukan dari input — input hanya membawa saldo dan alasan. Fungsi menghitung `delta`, menulis baris `stock_movements` (`initial` saat stok pertama kali diisi, `adjustment` setelahnya), dan menulis `kedai_stock.quantity` — tiga langkah tapi satu transaksi atomik.

Fungsi memakai **service role** (`createAdminClient()`) karena izinnya dicabut dari `anon`/`authenticated` — pola keamanan RPC yang setiap fungsi baru wajib ikuti (lihat dokumen 06).

## Mutasi: Alur Lengkap (M4-4, M4-5, M4-6)

```
Kasir Kedai A, /pos/stok      →  /pos/stok       → "Pindah Stok"
   pilih produk, jumlah, kedai tujuan, catatan  →  stock_mutations (pending)
Admin pusat, /admin/mutasi    →  "Setujui"      →  approve_mutation()
   stok A -, stok B +, dua baris ledger, status approved   (satu transaksi)
Kasir Kedai A                 →  /pos/stok       → badge "Disetujui" di riwayat
```

### Pengajuan (M4-6)

`ajukanMutasi` di `app/pos/(kasir)/stok/actions.ts`. Dua hal yang ditegakkan server:

- **`from_kedai_id` = `session.kedaiId`.** Kasir tidak bisa mengarahkan mutasi kedai lain. `requested_by_employee_id` juga dari sesi.
- **Peringatan stok tidak cukup**, bukan larangan: kasir boleh mengajukan lebih dari saldo saat ini (barang mungkin ditambah sebelum disetujui), tapi kalau saldo jelas menipis dia diberi tahu sekarang — bukan menunggu ditolak admin nanti.

Form memvalidasi tujuan ≠ kedai sendiri (`mutations_different_kedai` di database lapis kedua).

### Persetujuan (M4-4)

`setujuiMutasi` server action → RPC `approve_mutation`. Tombol "Tolak" meminta alasan wajib (constraint `mutations_rejected_needs_note` menegakkan di database), dan **hanya mutasi `pending` yang bisa ditolak** — setuju lalu tolak = mengubah jejak audit.

### Fungsi `approve_mutation` (M4-5) — inti dari semuanya

Persetujuan dan eksekusi mustahil dipisah karena keduanya adalah **satu transaksi**:

```sql
select * into m from stock_mutations where id = p_mutation_id for update;  -- kunci baris
```

1. **Lock baris dulu.** Dua admin yang menyetujui bersamaan mengantre; yang kedua melihat status yang sudah berubah, tidak saling melihat "pending".
2. **Guard status.** `approved` → idempoten (kembali tanpa memindahkan dua kali, penjaga pemanggilan ulang karena koneksi putus); selain `pending` → error.
3. **Stok asal dicek SAAT eksekusi**, bukan saat pengajuan — dengan `for update` pada baris `kedai_stock`. Kalau saldo sekarang tidak cukup, eksekusi ditolak, dan pesan error DB diteruskan ke kasir.
4. **Dua baris ledger** (`mutation_out` di asal, `mutation_in` di tujuan) + dua update saldo. Tujuan yang belum punya baris stok diisi lewat `insert ... on conflict do update`.
5. Idempotensi lapis kedua: unique index parsial `movements_once_per_mutation (ref_mutation_id, reason)` — approval ganda mustahil memindahkan stok dua kali, bahkan kalau pemeriksaan pertama terlewat.

### Efeknya di UI

- `/admin/mutasi` difilter default ke **Menunggu** (halaman pertama yang dibuka admin → yang paling relevan). Status lain via `?status=...`.
- Baris pending di-highlight ringan supaya admin tidak melewatinya.
- `/pos/stok` menampilkan riwayat **mutasi keluar** kedai ini dengan badge status — kasir yang menunggu jawaban bisa melihat sendiri tanpa bertanya ke WA.

## Keamanan RPC Mutasi

```sql
revoke all on function public.approve_mutation(uuid, uuid) from public, anon, authenticated;
```

Fungsi baru wajib diikuti pola yang sama seperti di dokumen 06 §Keamanan RPC: semua fungsi publik ter-expose sebagai endpoint, anon key selalu bocor, jadi izin harus dicabut dan pemanggilan hanya lewat `createAdminClient()` di server.

## Cara Menguji

```bash
npm run db -- supabase/tests/mutasi.sql       # 7/7: atomik & idempoten
npm run db -- supabase/tests/constraints.sql  # uji 5,9,13: mutasi dobel & ledger
npm run db -- supabase/tests/stok.sql         # 13/13: adjust_stock & ledger
```

Uji manual:

1. `/admin/stok` → pilih Kedai Melati → "Atur" sebuah produk → ubah jumlah, isi alasan → "Riwayat" → pastikan baris ada.
2. `/pos/stok` (Masuk dulu di `/pos/masuk`, kode `DEV-QR-RINA-0001`) → "Pindah Stok" → produk, jumlah 3, tujuan Kenanga → ajukan.
3. `/admin/mutasi` → baris pending muncul → "Setujui" → badge hijau.
4. `/admin/stok` → cek saldo Melati turun, saldo Kenanga naik. Ledger:
   ```bash
   npm run db -- -e "select reason, delta, quantity as mutasi from stock_movements where reason like 'mutation%' order by created_at desc limit 4"
   ```
5. Ulangi approve dengan stok asal dibuat kekurangan → approve harus ditolak dengan pesan "Stok kedai asal tidak mencukupi".

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| Approve ditolak "Stok kedai asal tidak mencukupi" | Saldo sekarang < jumlah mutasi | Tambah stok di kedai asal dulu, lalu setujui lagi |
| "Mutasi ini bukan pending" / "sudah berstatus" | Mutasi sudah diproses | Muat ulang halaman; barisnya sudah pindah ke filter lain |
| Persetujuan tidak memindahkan stok dua kali walau dipanggil ulang | Idempotensi index + guard bekerja | Cek `movements_once_per_mutation` tidak pernah absen |
| RPC `approve_mutation` error di browser | Dipanggil dengan anon key | Pastikan server action memakai `createAdminClient()` |
| Produk tidak muncul di `/pos/stok` | Belum ada baris `kedai_stock` | Isi dari `/admin/stok` (produk tanpa baris stok tidak tampil di POS — kasir tidak perlu melihat yang belum diatur) |

## Istilah

- **Ledger** — catatan pergerakan stok permanen (`stock_movements`); sumber kebenaran.
- **Mutasi** — pengajuan pindah stok antar kedai; status `pending` → `approved`/`rejected`.
- **Atomik** — semua langkah berhasil atau semua gagal; tidak ada kondisi di tengah-tengah.
- **Idempoten** — dijalankan berkali-kali hasilnya sama seperti sekali.
- **`for update`** — pengunci baris di Postgres; memaksa transaksi yang menyentuh baris sama berjalan berurutan.