# Database.md — Skema Database (Sistem Multi-Kedai)

Skema ini untuk **satu instance klien** (satu bisnis, banyak kedai/cabang di dalamnya) — sesuai keputusan deployment terpisah per klien, sehingga **tidak ada kolom `tenant_id`**. Semua tabel discope oleh `kedai_id` di dalam instance yang sama.

Database: **PostgreSQL** (via Supabase). Semua tabel pakai `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` kecuali disebutkan lain, dan `created_at TIMESTAMPTZ DEFAULT now()` di setiap tabel.

Zona waktu: semua `timestamptz` disimpan sebagai UTC. Batas "hari operasional" ditentukan kolom eksplisit `business_date`, bukan konversi timezone saat query — supaya laporan harian konsisten walau server dan kedai beda timezone.

**Mata uang: Ringgit Malaysia (RM)** — semua kolom nominal bertipe `numeric(12, 2)`. Tidak menggunakan `float`/`real`: pecahan sen harus eksak di aritmetika server. Label "RM" hanya masalah tampilan (lihat `Tasks.md` M6-1). Klien Indonesia bisa kembali ke Rupiah belakangan tanpa mengubah skema — cukup format di UI.

---

## 1. `kedai` (cabang)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| name | text | Nama cabang |
| address | text | Alamat |
| phone | text | Kontak cabang |
| timezone | text | Default `Asia/Kuala_Lumpur` — dipakai untuk menentukan `business_date`. Klien pertama Malaysia; kedai lain bisa ganti zona (mis. WIB) lewat pengaturan kedai |
| low_stock_threshold | integer | Default 5 — ambang batas indikator "stok menipis" |
| is_warehouse | boolean | Default false — true berarti **gudang pusat**: stok jadi hasil produksi berkumpul di sini dan menjadi sumber `assign` ke kedai. Tidak punya karyawan, tidak buka shift, tidak menerima transaksi kasir |
| is_active | boolean | Default true |
| created_at | timestamptz | |

## 2. `admin_users` (owner / admin pusat)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK, terhubung ke Supabase Auth user id |
| name | text | |
| email | text | Unique, login via email+password |
| role | text | `owner` \| `admin_pusat` |
| is_active | boolean | |
| created_at | timestamptz | |

## 3. `employees` (karyawan/kasir per kedai)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| kedai_id | uuid | FK → kedai.id |
| name | text | |
| role | text | `kasir` \| `admin_kedai` (untuk klien "satu kedai satu karyawan", yang dipakai praktis hanya `kasir`) |
| qr_token | text | Unique, token QR pribadi untuk **login sesi kasir** dan **membuka kedai** |
| is_active | boolean | |
| created_at | timestamptz | |

> **Tidak ada `attendance` lagi.** Absensi clock-in/out dihapus (keputusan adaptasi klien Malaysia): karyawan hanya login via QR, tidak absen. QR tetap dipakai untuk buka kedai bersama scan QR statis yang ditempel di kedai.

## 4. `shifts` (sesi buka/tutup kedai + rekonsiliasi kas)
Satu kedai **satu sesi terbuka** pada satu waktu (partial unique index). Ini yang dulu disebut "shift"; untuk klien ini konsepnya adalah sesi buka→tutup harian — tidak ada dimensi multi-karyawan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| kedai_id | uuid | FK → kedai.id |
| business_date | date | Hari operasional sesi (lihat §15) |
| opened_by | uuid | FK → employees.id |
| closed_by | uuid, nullable | FK → employees.id |
| opening_cash | numeric(12, 2) | Kas awal saat buka toko (modal awal) |
| closing_cash | numeric(12, 2), nullable | Kas fisik saat tutup — **input buta** (blind closing, lihat di bawah) |
| expected_cash | numeric(12, 2), nullable | Dihitung **server**: opening_cash + total transaksi tunai berstatus `completed` selama sesi |
| cash_difference | numeric(12, 2), nullable | closing_cash − expected_cash (untuk deteksi selisih) |
| reconciliation_status | text | `pending_sync` \| `final` — lihat "Tutup Sesi Saat Offline" di bawah |
| pending_sync_count | integer | Jumlah transaksi yang masih di antrian perangkat saat sesi ditutup. Dikurangi tiap antrian masuk; nol berarti kas boleh dianggap final |
| reconciled_at | timestamptz, nullable | Waktu `expected_cash` terakhir dihitung ulang server |
| opened_at | timestamptz | |
| closed_at | timestamptz, nullable | |
| status | text | `open` \| `closed` |

Constraint:
- Partial unique index pada `(kedai_id)` untuk baris berstatus `open` — mencegah dua sesi terbuka bersamaan di satu kedai.
- CHECK: status `closed` mengharuskan `closed_at` dan `closed_by` terisi.

### Blind Closing (input buta)
Angka yang "seharusnya" (`expected_cash`, `cash_difference`) **tidak pernah dikirim ke perangkat karyawan**. Saat tutup, karyawan hanya menginput `closing_cash` dan `sisa_fisik` (§5) tanpa melihat perbandingan. Server menyimpan semuanya; perbandingan hanya disajikan di sisi pemilik (halaman Collect, §7). Tujuannya mencegah karyawan menyesuaikan angka kas agar terlihat "pas".

### Tutup Sesi Saat Offline
Kasir tetap boleh menutup sesi walau masih ada transaksi di antrian lokal yang belum ter-sync. Internet mati total tidak boleh memblokir tutup toko — itu kejadian nyata di lapangan, bukan kasus tepi.

Alurnya:
1. Saat tutup, client mengirim jumlah transaksi yang masih tertahan di antrian — disimpan di `pending_sync_count`, karena server tidak punya cara mengetahuinya sendiri. Kalau lebih dari nol, sesi ditutup dengan `reconciliation_status = pending_sync` dan `expected_cash` diisi angka **sementara** dari data yang sudah sampai server.
2. UI tidak menampilkan selisih kas sama sekali ke karyawan (blind closing). Untuk pemilik, selisih yang belum final berbadge `warning`, bukan selisih sungguhan.
3. Setiap kali transaksi milik sesi itu masuk lewat endpoint sync, server menghitung ulang `expected_cash` dan `cash_difference`, lalu memperbarui `reconciled_at`.
4. Begitu tidak ada lagi transaksi tertunda untuk sesi tersebut, status berubah jadi `final`. **Collect (§7) hanya bisa dilakukan untuk sesi `final`** — data belum lengkap berarti perbandingan belum sah.

## 5. `sisa_fisik` (hitung fisik per produk saat tutup — input buta)
Dicatat bersamaan dengan tutup sesi. Ini yang menjadi "kebenaran" stok fisik di laci.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| shift_id | uuid | FK → shifts.id |
| product_id | uuid | FK → products.id |
| qty | integer | Stok fisik yang benar-benar tersisa. CHECK `qty >= 0` |
| entered_by | uuid | FK → employees.id |
| created_at | timestamptz | |

Unique constraint: (`shift_id`, `product_id`).

## 6. `waste` (stok hilang sah — basi, tumpah, sampel)
Stok keluar yang bukan penjualan. Tidak bisa diedit; alasan wajib.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| shift_id | uuid, nullable | FK → shifts.id |
| kedai_id | uuid | FK → kedai.id |
| product_id | uuid | FK → products.id |
| qty | integer | CHECK `qty > 0` |
| alasan | text | Wajib terisi |
| created_by_employee_id | uuid, nullable | FK → employees.id |
| created_by_admin_id | uuid, nullable | FK → admin_users.id |
| recorded_at | timestamptz | |

Constraint: `num_nonnulls(created_by_employee_id, created_by_admin_id) = 1` — pelapor bisa karyawan atau pemilik, tapi tepat satu.

Menulis `waste` selalu disertai baris `stock_movements` (reason `waste`, delta negatif, `ref_waste_id`) dalam satu DB transaction (§14).

## 7. `collect` (rekonsiliasi oleh pemilik)
Setiap sesi `final` **satu** kali di-collect. Di sini pemilik melihat angka "seharusnya" dan memutuskan sesuai atau tidak.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| shift_id | uuid | FK → shifts.id, **unique** |
| kedai_id | uuid | FK → kedai.id |
| dihitung_oleh_admin_id | uuid | FK → admin_users.id |
| setoran_seharusnya | numeric(12, 2) | Snapshot: closing_cash − opening_cash, dikoreksi kas keluar bila ada |
| setoran_diterima | numeric(12, 2), nullable | Uang yang benar-benar diserahkan pemilik |
| selisih_kas | numeric(12, 2) | setoran_seharusnya − setoran_diterima |
| status | text | `sesuai` \| `tidak_sesuai` |
| status_selisih | text | `terbuka` \| `dijelaskan` \| `dicatat_rugi` — resolusi selisih, workflow lihat "Status Selisih" |
| catatan | text, nullable | Penjelasan pemilik |
| dilakukan_at | timestamptz | |

### Status selisih
`terbuka` → (pemilik menindaklanjuti) `dijelaskan` atau `dicatat_rugi`. Sesi `tidak_sesuai` yang masih `terbuka` muncul di halaman **Perlu Perhatian** pemilik sampai ditutup.

### Perbandingan stok vs uang (di sisi pemilik)
Untuk tiap produk pada sesi:
```
selisih_stok = jumlah terjual tercatat − (stok tercatat saat tutup − sisa_fisik)
```
- `stok tercatat saat tutup` = `kedai_stock.quantity` dari ledger (nilai di akhir sesi).
- `sisa_fisik` = hitungan fisik buta (§5).
- Kalau `selisih_stok > 0`: barang hilang tanpa tercatat (dicuri/terbagi gratis/dll) → indikator bahaya.
- Kalau `selisih_stok < 0`: stok fisik lebih banyak dari catatan → kesalahan pencatatan.

Tidak perlu snapshot stok awal: angka "hilang" dihitung dari beda ledger akhir vs fisik, dan `waste` sudah mengurangi `stok tercatat` sehingga tidak dihitung hilang.

## 8. `products` (katalog produk — sederhana, tanpa varian)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| name | text | |
| price | numeric(12, 2) | Harga jual (RM) |
| category | text, nullable | Untuk pengelompokan tampilan di kasir |
| image_url | text, nullable | |
| is_active | boolean | |
| created_at | timestamptz | |

Catatan: katalog produk **shared** di seluruh kedai dalam satu instance (menu sama untuk semua cabang) — hanya stoknya yang per kedai (lihat `kedai_stock`).

## 9. `bahan_mentah` (katalog bahan — dicatat manual oleh pemilik)
Tidak ada pemasok/alur pembelian: pemilik menambah stok bahan secara manual (§10). Satuan bebas (gram, kg, bungkus, porsi) — tidak ada konversi antar satuan.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| name | text | |
| satuan | text | Mis. `gram`, `kg`, `bungkus`, `porsi` |
| harga_beli | numeric(12, 2), nullable | Opsional — dipakai di fase lanjut untuk modal per porsi |
| is_active | boolean | |
| created_at | timestamptz | |

## 10. `bahan_stock` (saldo stok mentah — hanya di gudang pusat)
| Kolom | Tipe | Keterangan |
|---|---|---|
| bahan_id | uuid | PK, FK → bahan_mentah.id (satu baris per bahan) |
| quantity | integer | Saldo saat ini. **Boleh negatif** (alasan sama dengan `kedai_stock`); koreksi lewat `bahan_movement` reason `koreksi` |
| updated_at | timestamptz | |

`quantity` adalah saldo turunan — sumber kebenarannya `bahan_movement` (§11), ditulis dalam satu DB transaction.

## 11. `bahan_movement` (ledger stok mentah — append-only)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK (dibuat client supaya input ganda idempotent) |
| bahan_id | uuid | FK → bahan_mentah.id |
| delta | integer | CHECK `delta <> 0` — negatif = keluar (produksi/koreksi), positif = masuk (penambahan manual) |
| balance_after | integer | Saldo `bahan_stock.quantity` setelah pergerakan |
| reason | text | `masuk` \| `produksi` \| `koreksi` |
| ref_produksi_id | uuid, nullable | FK → produksi.id — wajib untuk `produksi` |
| created_by_admin_id | uuid | FK → admin_users.id (hanya pemilik yang mengelola bahan) |
| note | text, nullable | Wajib untuk `koreksi` (alasan) |
| created_at | timestamptz | |

## 12. `produksi` + `produksi_bahan` (banyak bahan → satu produk jadi)
Produksi **input manual**: pemilik mengisi bahan yang dipakai dan hasil jadinya. **Tidak ada resep baku** — tiap run bisa memakai bahan berbeda tanpa paksaan konsistensi. Hasil selalu masuk gudang pusat (`kedai.is_warehouse`).

| `produksi` | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK (dibuat client) |
| product_id | uuid | FK → products.id — produk jadi |
| qty_hasil | integer | CHECK `qty_hasil > 0` |
| produced_by_admin_id | uuid | FK → admin_users.id |
| note | text, nullable | Catatan produksi |
| produced_at | timestamptz | Default now() |

| `produksi_bahan` | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| produksi_id | uuid | FK → produksi.id on delete cascade |
| bahan_id | uuid | FK → bahan_mentah.id |
| qty | integer | CHECK `qty > 0` — jumlah bahan yang dipakai |

Unique constraint `(produksi_id, bahan_id)`.

**Efek dalam satu DB transaction** (fungsi `record_produksi`):
1. Lock tiap `bahan_stock` yang terpakai (`for update`); kalau ada yang kurang, seluruh produksi ditolak (stok tidak boleh minus akibat produksi — beda dengan penjualan).
2. Tulis `bahan_movement` reason `produksi` (delta negatif) untuk tiap bahan.
3. Tulis `produksi` + `produksi_bahan`.
4. Tambah stok produk jadi di gudang pusat: update `kedai_stock` + `stock_movements` reason `produksi` (delta positif) di kedai warehouse.
Idempoten pada `produksi.id` — pemanggilan ulang mengembalikan hasil yang sudah ada.

## 13. `kedai_stock` (saldo stok jadi per kedai, termasuk gudang pusat)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| kedai_id | uuid | FK → kedai.id |
| product_id | uuid | FK → products.id |
| quantity | integer | Saldo stok saat ini (pcs) — **boleh negatif**, lihat catatan |
| updated_at | timestamptz | |

Unique constraint: (`kedai_id`, `product_id`).

**Kebijakan stok minus (keputusan MVP):** tidak ada CHECK `quantity >= 0`. Kasir tetap boleh menjual walau stok tercatat nol, karena (a) kasir bisa offline dengan cache stok yang sudah basi, dan (b) memblokir penjualan di bisnis F&B lebih merugikan daripada stok tercatat minus. Stok negatif ditampilkan dengan badge `danger` sebagai sinyal bahwa pencatatan perlu dikoreksi lewat penyesuaian manual (`stock_movements` dengan alasan `adjustment`).

Kolom `quantity` di tabel ini adalah **saldo turunan** — sumber kebenarannya ada di `stock_movements` (§14). Saldo dan ledger selalu ditulis dalam satu DB transaction yang sama.

## 14. `stock_movements` (ledger pergerakan stok jadi — append-only)
Setiap perubahan stok wajib menulis satu baris di sini. Tanpa ledger, selisih stok di lapangan tidak bisa ditelusuri sama sekali — dan menambahkan tabel ini setelah ada data produksi jauh lebih mahal daripada sekarang.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| kedai_id | uuid | FK → kedai.id |
| product_id | uuid | FK → products.id |
| delta | integer | Perubahan stok — negatif = keluar, positif = masuk. CHECK `delta <> 0` |
| balance_after | integer | Saldo `kedai_stock.quantity` setelah pergerakan ini (untuk audit cepat) |
| reason | text | `initial` \| `sale` \| `void` \| `mutation_out` \| `mutation_in` \| `adjustment` \| `produksi` \| `waste` |
| ref_transaction_id | uuid, nullable | FK → transactions.id (untuk `sale` / `void`) |
| ref_mutation_id | uuid, nullable | FK → stock_mutations.id (untuk `mutation_out` / `mutation_in`) |
| ref_produksi_id | uuid, nullable | FK → produksi.id (untuk `produksi` — di gudang pusat) |
| ref_waste_id | uuid, nullable | FK → waste.id (untuk `waste`) |
| created_by_employee_id | uuid, nullable | FK → employees.id |
| created_by_admin_id | uuid, nullable | FK → admin_users.id |
| note | text, nullable | Wajib diisi untuk `adjustment` (alasan koreksi) |
| created_at | timestamptz | |

Constraint:
- CHECK: alasan `sale`/`void` mengharuskan `ref_transaction_id` terisi; alasan `mutation_out`/`mutation_in` mengharuskan `ref_mutation_id` terisi; `produksi` mengharuskan `ref_produksi_id`; `waste` mengharuskan `ref_waste_id`.
- CHECK: `num_nonnulls(created_by_employee_id, created_by_admin_id) <= 1`.
- **Unique index idempotensi transaksi:** `(ref_transaction_id, product_id, reason)` untuk baris yang `ref_transaction_id`-nya tidak null.
- **Unique index idempotensi mutasi:** `(ref_mutation_id, reason)` untuk baris yang `ref_mutation_id`-nya tidak null.
- **Unique index idempotensi produksi:** `(ref_produksi_id, product_id)` untuk baris yang `ref_produksi_id`-nya tidak null.
- **Unique index idempotensi waste:** `(ref_waste_id)` untuk baris yang `ref_waste_id`-nya tidak null.

## 15. `stock_mutations` (pemindahan stok jadi antar lokasi)
Sekaligus menjadi **assign** (gudang pusat → kedai) dan **retur** (kedai → gudang pusat). `from_kedai_id` / `to_kedai_id` boleh menunjuk kedai ber-`is_warehouse` — karena warehouse hanyalah `kedai` biasa, seluruh mekanisme (approval, atomik, idempoten) terpakai ulang.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| from_kedai_id | uuid | FK → kedai.id |
| to_kedai_id | uuid | FK → kedai.id |
| product_id | uuid | FK → products.id |
| quantity | integer | CHECK `quantity > 0` |
| status | text | `pending` \| `approved` \| `rejected` |
| requested_by_employee_id | uuid, nullable | FK → employees.id |
| requested_by_admin_id | uuid, nullable | FK → admin_users.id |
| approved_by | uuid, nullable | FK → admin_users.id (approval admin pusat) |
| requested_at | timestamptz | |
| approved_at | timestamptz, nullable | |
| executed_at | timestamptz, nullable | Waktu stok benar-benar dipindahkan |
| note | text, nullable | Alasan/catatan (wajib untuk status `rejected`) |

Constraint:
- CHECK `from_kedai_id <> to_kedai_id`.
- **CHECK `num_nonnulls(requested_by_employee_id, requested_by_admin_id) = 1`** — pengaju bisa karyawan kedai atau admin pusat, tapi tepat satu.
- CHECK: status `approved` mengharuskan `approved_by` dan `approved_at` terisi.

Aturan assign: pemilik mengirim dari warehouse ke kedai → dibuat langsung berstatus `approved`+`executed` (pemilik adalah yang memutuskan). Permintaan oleh karyawan kedai (`requested_by_employee_id`) tetap `pending` sampai admin menyetujui. Efek ke `kedai_stock` dieksekusi saat `approved`: dua baris `stock_movements` (`mutation_out` + `mutation_in`) + dua update saldo + `executed_at` dalam satu DB transaction; approve ganda ditolak idempoten.

## 16. `transactions` (transaksi penjualan)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK (dibuat di client, jadi harus UUID bukan serial) |
| kedai_id | uuid | FK → kedai.id |
| shift_id | uuid | FK → shifts.id |
| employee_id | uuid | FK → employees.id (kasir yang input) |
| business_date | date | Hari operasional — ditetapkan server dari `created_at` + `kedai.timezone` |
| local_number | text | Nomor sementara buatan device saat offline, mis. `OFF-7K2M-0013`. Hanya rujukan sementara bagi kasir/pelanggan |
| transaction_number | text, nullable | Nomor urut final — **ditetapkan server**, null selama masih di antrian lokal |
| subtotal | numeric(12, 2) | |
| total | numeric(12, 2) | |
| payment_method | text | `tunai` \| `qris`. **Untuk klien Malaysia hanya `tunai` yang aktif.** `qris` (Midtrans) ditinggalkan — ekuivalen di Malaysia adalah DuitNow, bukan QRIS; kode dan tabelnya ditahan, tidak dipakai. Kalau klien Indonesia muncul kembali, tinggal aktifkan |
| status | text | `completed` \| `void` \| `perlu_review`. Sejak M8-1, void dimulai dari pengajuan kasir (`perlu_review`), stok tidak kembali, lalu pemilik setujui → `void` + stok balik atau tolak → `completed` (lihat `Tasks.md` M8-1) |
| voided_at | timestamptz, nullable | |
| voided_by | uuid, nullable | FK → employees.id |
| device_id | text | Identitas device kasir — komponen `local_number` sekaligus alat telusur masalah sync |
| synced_at | timestamptz, nullable | Waktu transaksi diterima server (null hanya selama di antrian client) |
| created_at | timestamptz | Waktu transaksi dibuat di device (bukan waktu sync) |

Unique constraint: (`kedai_id`, `business_date`, `transaction_number`).

### Kenapa `transaction_number` ditetapkan server
Nomor "urut per kedai per hari" **tidak bisa** dibuat di device: dua kasir yang offline bersamaan di kedai yang sama pasti menghasilkan nomor yang sama, dan tabrakan itu baru ketahuan saat sync — terlambat, karena nomornya sudah terlanjur disebut ke pelanggan.

Solusinya dua nomor terpisah:
- **`local_number`** dibuat device (prefix `OFF-` + potongan `device_id` + counter lokal). Unik per device, ditampilkan di layar sukses saat offline, dan tidak pernah diklaim sebagai nomor resmi.
- **`transaction_number`** diberikan server saat transaksi diterima, berurutan per (`kedai_id`, `business_date`). Urutannya mengikuti waktu **sampai di server**, bukan waktu dibuat di device — konsekuensi yang diterima supaya penomoran tetap rapat tanpa lubang.

UI riwayat menampilkan `transaction_number` kalau sudah ada, dan `local_number` dengan badge "belum sync" kalau belum.

## 17. `transaction_items`
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| transaction_id | uuid | FK → transactions.id |
| product_id | uuid | FK → products.id |
| product_name_snapshot | text | Nama produk saat transaksi (jaga histori kalau nama produk berubah) |
| price_snapshot | numeric(12, 2) | Harga saat transaksi |
| qty | integer | CHECK `qty > 0` |
| subtotal | numeric(12, 2) | |

## 18. `expenses` (pengeluaran/biaya operasional)
| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| kedai_id | uuid | FK → kedai.id |
| category | text | `bahan_baku` \| `listrik` \| `sewa` \| `gaji` \| `lainnya` |
| description | text | |
| amount | numeric(12, 2) | CHECK `amount > 0` |
| expense_date | date | |
| recorded_by_employee_id | uuid, nullable | FK → employees.id |
| recorded_by_admin_id | uuid, nullable | FK → admin_users.id |
| shift_id | uuid, nullable | FK → shifts.id — sesi yang sedang bekerja saat uang keluar |
| from_cash | boolean | Default `false`. `true` = uang diambil dari laci kas → mengurangi `expected_cash` sesi itu saat `reconcile_shift` |
| created_at | timestamptz | |

Constraint: **CHECK `num_nonnulls(recorded_by_employee_id, recorded_by_admin_id) = 1`**; **CHECK `not from_cash or shift_id is not null`** (`expenses_from_cash_requires_shift`, M8-3) — "dari kas" wajib tahu sesinya.

## 19. `notifikasi` (in-app, untuk pemilik)
Notifikasi hanya tampil di dalam aplikasi (lonceng + halaman **Perlu Perhatian**), tidak ada push/Telegram. Dibuat oleh server saat kejadian; dibaca saat aplikasi dibuka.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| for_admin_id | uuid | FK → admin_users.id — penerima |
| tipe | text | `kedai_buka` \| `kedai_tutup` \| `shift_selesai` \| `selisih` \| `void_review` \| `assign` \| `stock_low` \| `device_stale` \| `produksi` |
| ref_shift_id | uuid, nullable | FK → shifts.id |
| ref_transaction_id | uuid, nullable | FK → transactions.id |
| ref_collect_id | uuid, nullable | FK → collect.id |
| dibaca | boolean | Default false |
| created_at | timestamptz | |

## 20. `void_request` (pengajuan pembatalan, menunggu keputusan pemilik)
Dibuat oleh `request_void` (RPC) saat kasir meminta membatalkan transaksi dengan shift **masih terbuka**. Pembatalan tidak instan: status transaksi jadi `perlu_review` dan stok TIDAK dikembalikan sampai `decide_void` dijalankan pemilik.

| Kolom | Tipe | Keterangan |
|---|---|---|
| id | uuid | PK |
| transaction_id | uuid | FK → transactions.id |
| kedai_id | uuid | FK → kedai.id |
| requested_by_employee_id | uuid | FK → employees.id — kasir yang mengajukan |
| alasan | text | CHECK `char_length(btrim(alasan)) >= 3` |
| status | text | `pending` \| `approved` \| `rejected` |
| decided_by | uuid, nullable | FK → admin_users.id |
| decided_at | timestamptz, nullable | |
| note | text, nullable | Wajib diisi saat `rejected` |
| created_at | timestamptz | |

Constraint & epsilon:
- **CHECK `(status = 'pending') = (decided_by is null)`** (`void_request_decision_complete`) — keputusan tidak ada setengah-setengah.
- **CHECK `status <> 'rejected' or char_length(btrim(coalesce(note, ''))) >= 1`** (`void_request_rejected_needs_note`) — menolak tanpa alasan = ditolak.
- **Unique partial `(transaction_id) where status = 'pending'`** (`void_request_one_pending`) — satu transaksi maksimal satu pengajuan yang belum diputuskan; pengajuan ulang saat masih `pending` bersifat idempoten.
- `decide_void` mengunci baris `for update`; keputusan dua kali → ditolak; `approved` → status transaksi `void` + stok kembali via ledger reason `void` (created_by admin) + `voided_by` = karyawan pengaju.

---
## 21. Fungsi laporan ringkasan (M8-4)
Gratis untuk `authenticated`, ditolak untuk `public`/`anon`.

| Fungsi | Tabel yang dikembalikan | Logika |
|---|---|---|
| `report_harian(p_dari date, p_sampai date)` | tanggal, kedai_id, kedai, omzet, jumlah_transaksi, jumlah_void, jumlah_perlu_review, selisih_terbuka | Satu baris per (tanggal, kedai). `omzet` & `jumlah_transaksi` **hanya menghitung status `completed`**; void dan `perlu_review` dihitung terpisah di kolomnya sendiri (tidak "disembunyikan" dalam angka omzet). `selisih_terbuka` = jumlah shift `final` yang masih `difference_status = 'terbuka'`. Kedai tanpa transaksi tetap keluar (omzet 0). |
| `report_void_karyawan(p_dari date, p_sampai date)` | kedai_id, kedai, employee_id, employee, total_transaksi, jumlah_void, rasio_persen | Hanya karyawan yang punya ≥1 void. `total_transaksi` = `completed` + `void` (attribusi ke `employee_id`, kasir pemilik transaksi — *bukan* `voided_by`); `rasio_persen` = void ÷ total × 100, urut menurun. Baris 0017 menghitung dari `voided_by` (rasio selalu 100%); diperbaiki 0018 ke basis `employee_id`. |

Notifikasi `device_stale` (M8-4): ditulis server saat penutupan toko dengan antrian offline masih tersisa (`pending_sync_count > 0`) — angka kas belum final sampai antrian itu terkirim. Identitas perangkat = `transactions.device_id`/`qris_payments.device_id`; tidak ada tabel `devices` terpisah.

---
## Relasi Ringkas
```
kedai 1---N employees
kedai 1---N shifts
kedai 1---N kedai_stock N---1 products
kedai 1---N stock_movements N---1 products
kedai 1---N transactions 1---N transaction_items N---1 products
kedai 1---N expenses
kedai 1---N sisa_fisik N---1 products (per shift)
kedai 1---N waste N---1 products (per shift)
kedai 1---N void_request N---1 transactions (pengajuan pembatalan, M8-1)
shifts 1---N transactions
shifts 1---1 collect
shifts 1---N sisa_fisik
shifts 1---N expenses (kas keluar "from_cash", M8-3)
bahan_mentah 1---1 bahan_stock
bahan_mentah 1---N bahan_movement
produksi 1---N produksi_bahan N---1 bahan_mentah
produksi N---1 products
stock_movements N---1 transactions (nullable, untuk sale/void)
stock_movements N---1 stock_mutations (nullable, untuk mutation_in/out)
stock_movements N---1 produksi (nullable, produk masuk gudang pusat)
stock_movements N---1 waste (nullable)
stock_mutations N---1 kedai (from & to, dua FK ke kedai yang sama)
```

## Catatan Penting untuk Offline-First
- `transactions.id` dan `transaction_items.id` **harus dibuat sebagai UUID di client** (bukan auto-increment server) supaya transaksi yang dibuat offline langsung punya ID unik tanpa tabrakan saat sync.
- Sync mengirim transaksi lengkap (header + items) dalam satu batch/transaction DB, idempotent berdasarkan `id` (kalau `id` sudah ada di server, dianggap sudah tersimpan, tidak dobel).
- Pengurangan `kedai_stock.quantity` akibat transaksi **dilakukan di server saat sync diterima**, bukan dihitung ulang di client — supaya tidak ada race condition antar device di kedai yang sama. Idempotensinya dijamin unique index di `stock_movements` (§14), bukan hanya oleh pengecekan di kode aplikasi.
- Nomor urut resmi (`transaction_number`) dan `business_date` **ditetapkan server**, bukan client (§16).
- Sesi boleh ditutup saat antrian belum kosong; `expected_cash` dihitung ulang server sampai `reconciliation_status` jadi `final` (§4).
- Stok boleh minus; koreksi dilakukan lewat `adjustment` di ledger, bukan lewat UPDATE langsung ke `kedai_stock` (§13).
- Pengelolaan bahan & produksi adalah kerja pemilik (admin) — online, lewat server action. Berbeda dengan transaksi kasir, tidak perlu antrian offline di perangkat kasir.

## Belum Termasuk di Skema Ini (Sesuai Scope Adaptasi Klien Malaysia)
- Varian/modifier produk
- Resep baku (BOM yang memaksa konsistensi) — produksi dicatat manual per run, tanpa template
- Pajak/PPN per transaksi (SST Malaysia — fase lanjut, menunggu jawaban klien)
- Konversi satuan (satu satuan per bahan; tidak ada gram↔kg otomatis)
- Kombo/menu paket (fase lanjut)
- Refund QRIS/Midtrans: void tunai saja. Klien Malaysia di luar scope Midtrans (gunakan DuitNow bila ada, bukan QRIS), jadi "refund" = keputusan void pemilik di `/admin/void` (M8-1)
- Cetak struk/printer