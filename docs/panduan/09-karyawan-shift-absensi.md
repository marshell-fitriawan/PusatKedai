# 09 — Karyawan, Shift & Absensi

Mencakup **M3-1** (kelola karyawan), **M3-2** (kartu QR), **M3-5** (absensi), **M3-10** (riwayat shift admin). **M3-4** (sesi QR) dan **M3-6** (buka toko) sudah dibahas di [06-kasir-dan-transaksi](06-kasir-dan-transaksi.md), karena tanpa keduanya transaksi tidak bisa tersimpan.

## Apa Ini

Admin pusat membuat akun karyawan dan mencetak kartu QR-nya. Karyawan memakai kartu itu untuk masuk (sesi), jam masuk/keluar (absensi), dan bekerja di shift yang dibuka kasir. Admin pusat memantau semua shift dari semua kedai di satu halaman.

Satu rantai data: **karyawan → absensi → shift → transaksi**. Tiap taut pastinya dimulai dari identitas karyawan yang benar — itu sebabnya M3 dikerjakan sebelum transaksi, bukan sesudahnya.

## Kenapa Karyawan Bukan User Auth (M3-4, diulang singkat)

Karyawan tidak punya email/password dan bukan user Supabase Auth. Kalau mereka punya, admin harus mengatur sandi untuk puluhan orang, dan perangkat HP kasir tidak pernah log out — itu pintu yang lebih berbahaya daripada tidak punya akun sama sekali. Yang dipegang kasir adalah **token QR** (`employees.qr_token`), unik dan di-generate server.

`docs/design_1.md` adalah keputusan produknya; implementasinya ada di `lib/pos/session.ts` dan [06](06-kasir-dan-transaksi.md).

## Kelola Karyawan (M3-1)

Halaman `/admin/karyawan` + form modal `components/admin/karyawan-form.tsx`.

### Role sederhana, bukan RBAC lengkap

Dua role saja: `kasir` dan `admin_kedai`. Cukup untuk MVP: kasir boleh semua yang dibutuhkan POS, `admin_kedai` ditambah kewenangan yang sama dengan admin pusat untuk kedainya sendiri (belum dibangun). Tidak ada role per-fitur — sistem dengan 20 role berakhir dengan 18 role yang tidak pernah dipakai.

### QR token hanya bisa dibuat server

`generateQrToken()` memakai `randomBytes(18).toString("base64url")`:

```ts
// app/admin/(dashboard)/karyawan/actions.ts
function generateQrToken(): string {
  return randomBytes(18).toString("base64url");
}
```

Uji acaknya tidak disuruh ke form — token dibuat server, form hanya mengirim data karyawan. Kalau token dibuat client, seorang admin yang jahat bisa menebak pola token orang lain dan masuk sebagai mereka.

### Hard delete ditolak, ada tombol nonaktif

Tidak ada fungsi hapus karyawan. Alasan sama dengan larangan `DELETE` di transaksi: riwayat satukan karyawan — absensi, shift, transaksi — tetap harus bisa direkonstruksi. Karyawan yang berhenti cukup di-`is_active = false`; sesi POS yang masih hidup tidak otomatis dicabut (dibatasi satu minggu oleh `maxAge` cookie), tapi token QR tidak lagi bisa dipakai untuk masuk baru.

### Terbit ulang QR

`resetQrToken()` tidak menghapus token lama dengan cepat — itu sanksi "kartu hilang". Kalau ada salinan kartu lama beredar, salinan itu langsung mati. Perhatikan efeknya: anak panah apa pun yang memakai token lama (mis. kasir yang masih pegang kartu lama di HP lain) berhenti bekerja seketika.

## Kartu QR (M3-2)

Halaman `/admin/karyawan/[id]` merender kartu yang siap dicetak.

Alasan harga mati di sini: **token harus bisa dipindai, bukan diketik.** Kasir RP ribuan kali sehari; kartu yang menampilkan teks 24 karakter memaksa dia mengetik manual dan typo menjadi biaya waktu. Kode QR menebusnya.

Detail cetak:

- `window.print()` dari `components/ui/print-button.tsx`, dipicu tombol "Cetak".
- CSS `@media print` di `app/globals.css` menyembunyikan seluruh halaman kecuali `.print-area` — jadi yang tercetak kartunya saja, bukan UI admin.
- `qrcode` membuat PNG lewat `QRCode.toDataURL()` di server (halaman ini server component), dengan warna yang cocok dengan tema (bukan hitam) supaya hasil cetak tidak "pop" asing di kartu tua.
- Kartu menampilkan nama + kedai, dan token lengkap sebagai fallback teks — kalau suatu hari semua pemindai rusak, kasir bisa diketik dari kartu.

> **Beta:** belum ada template kartu nama/form A6 yang benar-benar diukur di atas kertas. Cetak satu dulu dengan printer toko lalu ukur dua-duanya sebelum memborong kartu — `print-area` adalah kartu tegak ~105×148 mm.

## Absensi (M3-5)

### Dua tombol, satu aturan

`/pos/absensi` hanya menawarkan dua aksi: **jam masuk** dan **jam keluar**. Tidak ada input waktu — waktu diambil server, `clock_in_at`/`clock_out_at` ber-`default now()`.

Kenapa knop sederhana ini cukup: MVP tidak membutuhkan laporan kehadiran yang rumit, tapi **butuh jawaban "siapa di kedai jam berapa"** yang bisa dipercaya oleh admin. Input manual = data yang diketik sendiri, nilainya nol untuk audit.

### Satu jam masuk terbuka per karyawan, dijaga database

Partial unique index `attendance_one_open_per_employee` pada `attendance (employee_id) where clock_out_at is null`.

Pencegahan **dua lapis**, pola yang sama dengan shift:

1. Server action `clockIn()` menanya dulu apakah ada catatan terbuka (untuk pesan ramah: "Kamu sudah jam masuk hari ini").
2. Database menegakkan lewat index (lapis yang tidak bisa diakali) — ditangkap via `error.code === "23505"`.

Kalau karyawan masuk tiga kedai berbeda di hari yang sama, hanya SEDANG terjaga satu catatan terbuka — harus jam keluar dulu sebelum jam masuk di tempat lain.

### Clock-in melekat ke shift yang sedang terbuka

```ts
const shift = await getOpenShift(session.kedaiId);
// attendance.shift_id = shift?.id ?? null
```

Relasinya ke shift boleh null (kasir bisa absen sebelum toko dibuka), tapi kalau shift sedang terbuka, absensi ikut tercatat di sana. Dengan begini admin bisa menjawab "yang kerja shift siang siapa saja" tanpa menebak dari jam.

### Jam keluar tidak pernah membuat baris sendiri

Kalau `clockOut()` tidak menemukan catatan terbuka, ia **pulang dengan pesan error**, bukan membuat baris baru ber-`clock_out_at`. Menutup absensi yang tidak pernah dibuka = mengarang data hadir yang tidak pernah terjadi.

## Riwayat Shift Admin (M3-10)

`/admin/shift` menampilkan semua shift semua kedai, difilter `kedai` + rentang tanggal.

### Filter tanpa JavaScript

Form GET biasa: `components/admin/shift-list.tsx` memakai `<Select name="kedai">` + `<Input name="dari" type="date">` di dalam `<form method="get">`. Field-name menjadi searchParams, halaman server di-render ulang. Bukan keharusan teknis — konsisten dengan `stok-list` dan tidak butuh JavaScript apa pun untuk bekerja.

### Satu aturan laporan: shift `pending_sync` TIDAK dihitung

Selisih kas shift yang masih menunggu data offline (`reconciliation_status = 'pending_sync'`) adalah **angka sementara** — transaksi dari device lain belum masuk (lihat `docs/panduan/07` atau docs/Database). Tabel menampilkannya dengan badge kuning dan caption, tapi baris itu **dikecualikan dari total selisih** di bawah tabel:

```ts
if (s.status === "closed" && s.reconciliation_status === "final") {
  totalSelisih += Number(s.cash_difference ?? 0);
}
```

Kalau pending ikut dijumlahkan, admin bisa tutup buku dengan selisih pembohong.

## Cara Menguji

```bash
npm run db -- supabase/tests/constraints.sql   # uji 16: dua clock-in terbuka ditolak
npm run db -- supabase/tests/shift.sql         # 13/13
```

Uji manual:

1. `/admin/karyawan` → tambah karyawan "Dewi" di Kedai Melati → cetak kartunya dari `/admin/karyawan/[id]`
2. `/pos/masuk` → pindai kartu Dewi (fallback: ketik kode yang tercetak di kartu itu) → masuk POS
3. `/pos/absensi` → jam masuk → jam keluar → cek durasi muncul di riwayat
4. `/pos/shift` → buka toko di Melati → coba absen lagi → beri tahu karyawan yang sama gabisa jam masuk dua kali
5. `/admin/shift` → filter kedai & tanggal → pastikan shift `pending_sync` berbadge kuning dan tidak ikut total

> Token QR karyawan **dibuat acak oleh sistem** saat karyawan ditambahkan, jadi kode kartunya bukan `DEV-QR-...` seperti pada seed dev. Yang ada awalan `DEV-QR-` hanya tiga karyawan seed: Rina, Budi, dan Sari. Kalau kartu Dewi tidak mau dipindai, periksa ulang kode yang tercetak di kartunya — bukan menebak pola kodenya.
>
> Langkah 4 memakai Melati karena seed dev sengaja **tidak** meninggalkan shift terbuka di Melati, jadi "Buka Toko" bisa langsung dicoba. Kenanga justru dibiarkan terbuka hari itu.

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| "Kamu sudah jam masuk hari ini" | Ada catatan terbuka (atau index menolak) | Cek `npm run db -- -e "select employee_id, clock_in_at from attendance where clock_out_at is null"` |
| Kartu tidak lagi bisa dipindai | Token QR pernah diterbitkan ulang | Cetak kartu baru dari `/admin/karyawan/[id]` |
| Karyawan hilang dari daftar | `is_active` false, bukan DELETE | Daftar hanya menampilkan karyawan aktif; cek dengan select manual |
| Satu shift dobel di tabel | Dua kedai punya shift terbuka bersamaan — itu normal | Filter per kedai di `/admin/shift` |
| Printer mencetak seluruh halaman admin | Selector `.print-area` hilang dari `app/globals.css` | Pulihkan blok `@media print` + markup `.print-area` di kartu |

## Istilah

- **Token QR** — string acak penyimpan id karyawan; dicocokkan dengan `employees.qr_token`, bukan mekanisme pesan rahasia.
- **Partial unique index** — index unik yang hanya berlaku sebagian baris (`where status = 'open'`), benda di database.
- **Idempoten** — dijalankan berkali-kali hasilnya sama seperti sekali.
- **`pending_sync`** — shift masih menunggu transaksi dari antrian offline; angka kasnya belum final.