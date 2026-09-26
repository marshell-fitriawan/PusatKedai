# 12 — Pembayaran QRIS (Midtrans)

Cara pembayaran QRIS bekerja end-to-end: dari kasir memilih "Bayar QRIS", sampai transaksi tercatat dan muncul di laporan. Baca dulu [06 Kasir & Transaksi](06-kasir-dan-transaksi.md) soal pola transaksi, dan [02 Database](02-database.md) soal penomoran shift, karena QRIS memakai keduanya.

---

## 1. Alur singkat

1. Kasir memilih **Bayar QRIS** pada keranjang (`mulaiQris` di `app/pos/(kasir)/kasir/actions.ts`).
2. Server menyimpan baris `qris_payments` berstatus `created` (snapshot items, shift, karyawan, kedai, total) lalu minta **charge** ke Midtrans (`payment_type=qris`). Hasil charge berupa string EMVCo (dirender jadi QR di perangkat) atau URL gambar.
3. Pelanggan memindai QR dan membayar di aplikasi pembayaran.
4. Konfirmasi sampai lewat **dua jalur yang sah dan boleh tumpang tindih**:
   - **webhook** Midtrans (`app/api/midtrans/webhook/route.ts`) — cepat, andal;
   - **polling** kasir (`app/api/midtrans/status/route.ts`) — cadangan, kalau webhook telat.
   Keduanya pada akhirnya memanggil fungsi DB yang sama: `confirm_qris_payment()`.
5. Saat status jadi `paid`, transaksi sungguhan dibuat dan stok berkurang tepat ketika itu — bukan saat QR ditampilkan.

## 2. Kenapa transaksi dicatat terlambat (saat bayar), bukan saat charge

`create_transaction` mengurangi stok dan mencatat ledger. Kalau itu dilakukan saat QR baru tampil, barang terkunci untuk pembayaran yang belum tentu selesai. Stok baru berkurang saat pembayaran **dikonfirmasi**. Aturan lama masih berlaku: terjadi di dalam SATU DB transaction, dan sudah `paid` tidak mungkin diputar kembali.

## 3. Kenapa id pembayaran = id transaksi

`qris_payments.id` adalah UUID yang dipakai juga sebagai `transactions.id`. Dua jalur konfirmasi (webhook + polling) yang tiba bersamaan tidak punya cara untuk membuat duplikat: `confirm_qris_payment()` mengunci baris pembayaran (`for update`), yang kedua menunggu yang pertama selesai, lalu membaca transaksi yang sudah ada (idempoten).

`order_id` Midtrans berbentuk `POS-<uuid>` — unik, dan cukup untuk mencari pembayaran dari webhook maupun status API.

## 4. QRIS tidak mengubah kas tunai

Rekonsiliasi shift (`0006`, `payment_method='tunai'`) tidak menyentuh QRIS. Pembayaran QRIS yang dikonfirmasi setelah shift ditutup tetap menempel ke shift itu tanpa mengubah angka uang tunai di catatan.

## 5. DB: `qris_payments` + `confirm_qris_payment()`

Migration `supabase/migrations/0012_qris_payments.sql`. Kolom penting:

- `items jsonb` + `total numeric` — snapshot yang **dihitung ulang server** saat charge; client tidak menentukan total.
- `status text` — `created → paid/expired/failed`, dengan constraint `qris_paid_complete` (`paid` wajib punya `paid_at` dan `transaction_id`).
- `qr_content` / `qr_image_url` — dua bentuk QR yang disimpan agar klien punya pilihan render.
- `expires_at` — QR berlaku 5 menit (`QRIS_EXPIRY_MENIT`).

Fungsi `confirm_qris_payment(p_payment_id, p_paid_at)` adalah **satu-satunya** tempat "pembayaran QRIS menjadi transaksi". `p_paid_at` (waktu bayar dari Midtrans / saat polling sukses) menjadi `created_at` transaksi; `business_date` dihitung dari zona waktu kedai. Dipanggil dua kali → aman.

### Keamanan akses

`qris_payments` DILARANG dibaca/ditulis lewat PostgREST: RLS aktif, permission `anon`/`authenticated` dicabut, hanya `service_role`. Server (charge, polling, webhook) memakai `lib/supabase/admin.ts`. Andai key anon bocor ke browser, tetap tidak ada jalur ke data pembayaran.

## 6. Webhook

`POST /api/midtrans/webhook` — **tanpa sesi app** (yang menelepon Midtrans). Pintunya satu: verifikasi signature.

```
signature_key = sha512(order_id + status_code + gross_amount + server_key)
```

- Signature tidak cocok → **401**.
- `order_id` bukan `POS-<uuid>` → 200 kosong (bukan urusan kami; jangan ganggu Midtrans dengan retry).
- `gross_amount` beda dengan `total` tersimpan → **400** (nominal jangan diproses).
- Notifikasi `settlement` tapi pembayaran tidak dikenal → 200 kosong (tidak akan pernah berubah).
- Gagal memproses (mis. koneksi DB) → **500** supaya Midtrans mengulang.

Kalau `transaction_time` rusak/kosong, `paid_at` memakai waktu sekarang.

## 7. Polling kasir

`GET /api/midtrans/status?paymentId=...` butuh **POS session** (ketat, berbeda dari webhook). Siklus hidup polling berpusat di DB: `qris_payments` yang sudah `paid/expired/failed` langsung dijawab dari DB tanpa menelepon Midtrans; hanya yang masih `created` yang diteruskan ke status API lalu diselesaikan lewat `laporkanStatusQris`.

UI di `components/pos/kasir-screen.tsx` memindai ulang tiap ±2,5 dtk sambil QR tampil, sampai `paid`, `expired`, `failed`, atau kasir membatalkan.

## 8. Mode MOCK (kunci server kosong)

Belum punya akun Midtrans berbayar → `MIDTRANS_SERVER_KEY` kosong → **mode mock** aktif: semua diputar di memori server, QR tetap dirender, dan pembayaran "lunas" otomatis ±15 dtk setelah charge tanpa pindai beneran. Cocok untuk demo dan uji alur end-to-end.

- `Mock.server key` dipakai verifikasi webhook uji: `SB-Mid-server-MOCK-0000000000000000` (lihat `MOCK_SERVER_KEY` di `lib/payment/midtrans.ts`).
- State mock di memori satu proses server — cukup untuk kasir (satu perangkat), TIDAK aman lintas restart.
- Begitu key asli diisi di `.env.local`, semua bagian beralih ke API sungguhan tanpa perubahan kode.

### Env yang dipakai

| Var | Nilai mock | Fungsi |
|---|---|---|
| `MIDTRANS_SERVER_KEY` | (kosong) | Memilih mode; key Basic Auth charge/status & verifikasi webhook |
| `MIDTRANS_ENV` | `sandbox` | Host charge `app.*.midtrans.com` vs `api.*.midtrans.com` |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | tidak dipakai saat ini | Cadangan untuk snap/UI Midtrans bila dipakai nanti |

## 9. Kode inti

| File | Isi |
|---|---|
| `lib/payment/midtrans.ts` | charge/status API (real + mock), `rekapStatus()`, `verifikasiWebhook()`, `MOCK_SERVER_KEY`, `QRIS_EXPIRY_MENIT` |
| `lib/payment/settle-qris.ts` | `laporkanStatusQris()` — jembatan webhook + polling menuju DB |
| `app/api/midtrans/webhook/route.ts` | verifikasi signature + penyelesaian pembayaran |
| `app/api/midtrans/status/route.ts` | polling kasir (perlu POS session) |
| `app/pos/(kasir)/kasir/actions.ts` | `mulaiQris` — simpan pembayaran + charge, bayar pakai konvensi server action |
| `components/pos/kasir-screen.tsx` | selektor metode (Tunai/QRIS), render QR, timer polling |
| `supabase/migrations/0012_qris_payments.sql` | tabel + `confirm_qris_payment()` + RLS |

## 10. Menguji

Uji DB: `supabase/tests/qris.sql` (18/18). Uji HTTP webhook:

1. Insert fixture `qris_payments` berstatus `created` (pakai `npm run db`).
2. Hitung `signature_key` dengan mock server key, POST `settlement` → 200 `{"ok":true,"status":"paid"}`.
3. Verifikasi `transactions` berisi `payment_method='qris'` + stok/ledger 1 baris.
4. Kirim ulang → tetap `paid` tanpa duplikat; signature salah → 401; `gross_amount` beda → 400.

Jangan lupa bersihkan baris fixture setelah uji (hapus `qris_payments` sebelum `transactions`).