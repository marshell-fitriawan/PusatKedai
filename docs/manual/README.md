# Manual Book — Sistem Multi-Kedai

Panduan pemakaian untuk **pemilik kedai** dan **karyawan kedai**. Ditulis dengan
bahasa sehari-hari, bukan istilah komputer. Tidak ada langkah yang perlu
dihafal — semua bisa dibuka ulang dari halaman ini.

> Alur kerja harian (pagi, siang, tutup toko) ada di dokumen terpisah:
> [**Alur Kerja Harian**](alur-kerja-harian.md). Dokumen itu yang paling sering
> dipakai sehari-hari; dokumen ini untuk mencari cara memakai satu fitur
> tertentu.

---

## 1. Sistem ini apa, dan untuk siapa

Sistem Multi-Kedai adalah satu aplikasi dengan **dua pintu**:

| Pintu | Untuk siapa | Dipakai di | Isinya |
|---|---|---|---|
| **Kasir** | Karyawan di kedai | HP/tablet di kedai | Jual barang, lihat stok, riwayat, buka/tutup toko |
| **Admin Pusat** | Pemilik & admin | HP atau komputer | Pantau penjualan, kas, stok, laporan, kelola cabang & karyawan |

Karyawan **tidak boleh** masuk pintu Admin Pusat, dan sebaliknya. Tiap pintu
punya cara masuknya sendiri (lihat [bagian 3](#3-cara-masuk-ke-sistem)).

### Yang penting dipahami sejak awal

- **Sistem tetap jalan walau internet mati.** Penjualan tunai di kedai
  disimpan dulu di HP, lalu dikirim ke pusat begitu ada sinyal. Karena itu
  kadang muncul tulisan **"belum tersinkron"** — itu normal, bukan error, dan
  akan hilang sendiri.
- **Uang tidak pernah hilang diam-diam.** Semua transaksi disimpan sebagai
  catatan yang tidak bisa dihapus. Kalau ada yang salah, transaksinya
  **dibatalkan** (dengan alasan), bukan dihapus.
- **Semua yang diubah punya jejak.** Mengubah stok, menambah biaya,
  membatalkan transaksi — semuanya tercatat siapa, kapan, dan alasannya.
- **Semua angka dalam Ringgit Malaysia (RM)** dan selalu bulat (tanpa sen).

---

## 2. Kamus istilah

Beberapa tombol memakai istilah yang mungkin asing. Artinya:

| Istilah di sistem | Artinya |
|---|---|
| **Shift** / **Buka Tutup** | Satu hari kerja satu kedai. "Buka Toko" saat mulai, "Tutup Toko" saat pulang. |
| **Kas awal** | Uang fisik di laci sebelum mulai berjualan. |
| **Kas fisik di laci** | Uang sungguhan yang dihitung saat tutup toko. |
| **Setoran** | Pencocokan uang laci dengan catatan penjualan, dilakukan pemilik. |
| **Selisih kas** | Beda antara uang yang seharusnya ada dengan uang yang benar-benar ada. |
| **Kas belum dibereskan** | Ada selisih kas yang belum dijelaskan/diputuskan pemilik. |
| **Pembatalan (Void)** | Membatalkan transaksi yang sudah terjadi. Harus disetujui pemilik. |
| **Menunggu keputusan** | Pengajuan pembatalan sudah dikirim kasir, menunggu pemilik memutuskan. |
| **Mutasi / Pindah Stok** | Memindahkan stok barang dari satu kedai ke kedai lain. Harus disetujui pemilik. |
| **Waste / Stok Hilang** | Barang rusak, tumpah, atau kedaluwarsa. Dicatat supaya tidak disangka hilang dicuri. |
| **Angka pasti** | Hitungan yang sudah lengkap — semua transaksi sudah masuk pusat. |
| **Angka sementara** | Hitungan yang masih menunggu sebagian data masuk; angkanya masih bisa berubah. |
| **Antrian belum terkirim** | Transaksi yang masih tersimpan di HP dan belum sampai ke pusat. |
| **Hitung kasir** vs **Di sistem** | Jumlah stok menurut hitungan mata kasir, vs menurut catatan aplikasi. |
| **Produksi** | Mencatat bahan mentah diolah menjadi barang jadi di gudang pusat. |

---

## 3. Cara masuk ke sistem

### 3.1 Karyawan kedai (pintu Kasir)

1. Buka alamat aplikasi di HP/tablet kedai.
2. Di halaman depan, pilih **Kasir**.
3. Halaman **Mulai Sesi Kasir** akan muncul. Ada dua cara:
   - **Pakai kamera:** arahkan kamera ke kartu QR milik karyawan. Begitu
     terbaca, sesi langsung terbuka — tidak perlu menekan tombol apa pun.
   - **Ketik manual:** kalau kamera bermasalah, ketik kode di kartu (misalnya
     `DEV-QR-AMINAH-0001`) di kolom **Kode kartu**, lalu tekan **Mulai Sesi**.
4. Setelah masuk, layar utama adalah **Kasir**, dan nama kedai serta nama
   karyawan tampil di bagian atas.

> Kartu QR itu **identitas karyawan**. Jangan di foto lalu dibagikan. Kalau
> hilang atau dicurigai disalin orang, minta pemilik menerbitkan kartu baru
> (lihat [Karyawan](#513-karyawan)). Kartu lama langsung mati.

### 3.2 Pemilik / admin pusat (pintu Admin Pusat)

1. Buka alamat aplikasi, pilih **Admin Pusat**.
2. Masuk dengan **Email** dan **Password** akun Anda, lalu tekan **Masuk**.
3. Setelah masuk, Anda mendarat di **Dashboard**.

> Lupa password atau mau menambah admin pusat baru? Hubungi teknisi/pihak yang
> mengelola sistem — akun admin pusat dibuat di sisi pusat, bukan dari dalam
> aplikasi.

---

## 4. Panduan Karyawan Kedai (pintu Kasir)

Di bawah layar selalu ada 4 menu: **Kasir · Stok · Riwayat · Shift**.

### 4.1 Buka toko (Shift)

**Dilakukan sekali setiap pagi, sebelum jualan pertama.**

1. Buka menu **Shift**.
2. Di kolom **Kas awal**, ketik jumlah uang fisik yang ada di laci saat itu.
   Hitung sungguhan uangnya, jangan menebak.
3. Tekan **Buka Toko**.

Setelah toko terbuka, penjualan baru bisa dicatat. Kalau menekan **Bayar**
sebelum toko dibuka, sistem akan menolak dan mengingatkan.

> **Hanya satu toko boleh terbuka** untuk satu kedai pada satu waktu. Kalau
> muncul pesan bahwa toko sudah terbuka, berarti shift hari itu belum ditutup.

### 4.2 Melayani penjualan (Kasir)

1. Buka menu **Kasir**.
2. Cari produk lewat kolom **Cari produk**, atau saring dengan tombol kategori
   (**Semua**, **Kopi**, **Makanan**, dst.).
3. Ketuk produk untuk menambahkannya ke keranjang. Angka kecil di pojok kartu
   produk menunjukkan berapa yang sudah masuk keranjang.
4. Kalau keranjang sudah berisi, bilah di bawah menampilkan jumlah item dan
   total. Tekan **Lihat Keranjang**.
5. Di jendela keranjang:
   - Atur jumlah dengan tombol **−** dan **+**, atau hapus item dengan ikon
     tong sampah.
   - Pilih **Tunai** atau **QRIS** (lihat [4.3](#43-pembayaran-qris)).
   - Tekan **Bayar Tunai RM …**.
6. Layar **Transaksi Berhasil** muncul beserta nomor transaksi. Tekan
   **Transaksi Baru** untuk melayani pelanggan berikutnya.

**Tentang stok di layar kasir:** tulisan **Stok 3**, **Sisa 2**, atau
**Stok −1** hanya informasi. Kasir **tetap boleh menjual** walau stok tertulis
nol atau minus, karena HP mungkin belum menerima data terbaru dari kedai lain.
Jangan menolak pelanggan hanya karena angka stok.

**Nomor sementara:** kalau di struk layar tertulis *"Nomor sementara"*, artinya
transaksi aman tersimpan di HP dan sedang menunggu dikirim ke pusat. Nomor
resminya muncul otomatis setelah terkirim. Tidak perlu mengulang transaksi.

### 4.3 Pembayaran QRIS

1. Setelah keranjang siap, pilih **QRIS** (bukan Tunai).
2. Tekan **Bayar QRIS RM …**.
3. Minta pelanggan memindai QR yang muncul dengan aplikasi apa pun yang
   mendukung QRIS (Gopay, OVO, ShopeePay, atau m-banking).
4. Layar menampilkan **"Menunggu pembayaran…"**. Tunggu sampai muncul
   **Transaksi Berhasil**.

Catatan penting:

- **QRIS butuh internet.** Kalau tidak ada koneksi, sistem menolak dan meminta
  pakai Tunai.
- **Jangan tekan Batal setelah pelanggan mulai memindai.** Kalau pelanggan
  sudah membayar, transaksinya tetap tercatat walau layar ditutup.
- Kalau QR kedaluwarsa, minta pelanggan memindai ulang dengan menekan bayar
  QRIS lagi.

### 4.4 Melihat riwayat & mengajukan pembatalan (Riwayat)

1. Buka menu **Riwayat**.
2. Pilih tanggal lewat kolom **Tanggal** (default hari ini). Ringkasan di atas
   menunjukkan jumlah transaksi, total, yang menunggu review, dan yang sudah
   dibatalkan.
3. Ketuk satu transaksi untuk melihat rincian itemnya.

**Mengajukan pembatalan** (misalnya salah input pesanan):

1. Buka transaksi yang ingin dibatalkan.
2. Isi **Alasan pembatalan** (minimal 3 karakter, contoh: *"salah kasih
   pesanan, pelanggan protes rasanya"*).
3. Tekan **Ajukan Pembatalan**, lalu **Kirim Pengajuan**.

Penting:

- **Pembatalan tidak langsung terjadi.** Pemilik yang memutuskan.
- **Stok tidak kembali sekarang.** Kalau pemilik menyetujui, stok baru
  dikembalikan dan nilainya dikeluarkan dari omzet.
- **Pembatalan hanya bisa diajukan saat toko sedang buka.** Kalau toko sudah
  tutup, mintakan pemilik membatalkan lewat menu Pembatalan di Admin Pusat.

### 4.5 Melihat & memindah stok (Stok)

1. Buka menu **Stok**. Daftar menampilkan semua produk dan jumlahnya di kedai
   Anda. Label **Menipis** (kuning), **Habis/Minus** (merah), atau **Aman**
   (hijau).
2. Bagian bawah menampilkan **Mutasi Keluar** — riwayat pengajuan pindah stok
   dari kedai Anda beserta statusnya (Menunggu / Disetujui / Ditolak).

**Memindahkan stok ke kedai lain:**

1. Tekan **Pindah Stok**.
2. Pilih **Produk**, isi **Jumlah**, pilih **Ke kedai** tujuan.
3. Tambahkan **Catatan** bila perlu (opsional), lalu tekan **Ajukan**.

Pindah stok **butuh persetujuan pemilik**. Stok baru benar-benar berpindah
setelah disetujui di Admin Pusat. Kalau stok kedai Anda tidak cukup, pengajuan
akan ditolak otomatis.

### 4.6 Mencatat barang rusak/tumpah (Waste)

Dilakukan dari menu **Shift**, di bagian **Stok Hilang (Waste)**.

1. Pilih **Produk**.
2. Isi **Jumlah** yang rusak/hilang.
3. Isi **Alasan** (wajib, minimal 3 karakter, contoh: *"susu tumpah saat
   penyajian"*).
4. Tekan **Catat Waste**.

Stok langsung berkurang dan catatannya bisa dilihat pemilik. Biasakan mencatat
kejadian seperti ini **saat itu juga**, supaya selisih stok saat tutup toko
tidak terlihat seperti kehilangan yang mencurigakan.

### 4.7 Menutup toko & hitung fisik (Shift)

**Dilakukan setiap tutup kedai, setelah pelanggan terakhir.**

1. Buka menu **Shift**.
2. Di bagian **Hitung Fisik Sisa Stok**, hitung sisa barang sungguhan di
   rak/laci. Setiap baris sudah terisi angka catatan sistem sebagai
   pembanding — **ubah hanya yang berbeda** dengan hitungan Anda. Kalau barang
   habis, isi `0`. Lalu tekan **Simpan Hitungan**.
3. Tekan **Tutup Toko**.
4. Isi **Kas fisik di laci** dengan uang sungguhan yang Anda hitung. Jangan
   menyalin angka dari sistem.
5. Tekan **Tutup Toko** pada jendela konfirmasi.

Setelah ditutup, muncul pesan **"Toko Ditutup"**. Kalau masih ada transaksi
yang belum terkirim, akan muncul label **"Belum final"** — toko tetap boleh
ditutup, dan selisih kas dihitung ulang otomatis begitu semua data terkirim.

> Pemilik bisa melihat **selisih kas** dan **selisih stok** Anda, tapi Anda
> tidak. Fokuslah pada hitungan yang jujur — sistem ini memang dibuat untuk
> melindungi kasir yang bekerja benar.

### 4.8 Indikator antrian (di layar Kasir)

Di atas daftar produk kadang muncul bilah kecil:

| Tampilan | Artinya | Yang harus dilakukan |
|---|---|---|
| *(tidak muncul)* | Semua sudah terkirim, online | Tidak ada |
| **"Mode offline — penjualan tetap bisa dicatat"** | Internet mati | Tetap jualan seperti biasa |
| **"Mengirim N transaksi…"** | Sedang mengirim ke pusat | Tunggu sebentar |
| **"N transaksi belum tersinkron"** | Ada antrian, koneksi ada | Tunggu; sistem mengirim otomatis |
| **"N transaksi gagal terkirim"** | Ada yang gagal | Tekan **Coba lagi** |

Jangan menutup aplikasi paksa saat masih ada antrian kalau bisa dihindari.
Kalau antrian tetap macet, lapor ke pemilik/teknisi.

---

## 5. Panduan Pemilik / Admin Pusat

Menu di sisi kiri (atau lewat tombol menu di HP):
**Dashboard · Perlu Perhatian · Kedai · Produk · Bahan Mentah · Produksi ·
Stok · Mutasi · Karyawan · Buka Tutup · Setoran · Pembatalan · Pengeluaran ·
Laporan**.

### 5.1 Dashboard

Ringkasan cepat seluruh cabang:

- **Omzet**, **Pengeluaran**, **Selisih**, dan **Rata-rata per hari** pada
  rentang tanggal yang dipilih.
- **Tren omzet** dalam bentuk grafik.
- **Omzet per Kedai** — kontribusi tiap cabang terhadap total.

Gunakan tombol **Tampilan** (Harian/Mingguan/Bulanan) dan kolom **Dari/Sampai**
lalu tekan **Tampilkan** untuk mengubah rentang. Tautan **Perbandingan kedai**
membuka halaman perbandingan antar cabang.

### 5.2 Perlu Perhatian

Halaman pemeriksaan harian pemilik. Isinya:

- **Notifikasi** — pemberitahuan sistem (penutupan toko, dll.). Yang belum
  dibaca dihitung sebagai badge di menu.
- **Kas belum dibereskan** — penutupan toko yang masih punya selisih kas.
  Tombol **Buka Setoran** membawa Anda ke halaman penyelesaian.
- **Antrian belum terkirim** — toko sudah tutup tapi masih ada transaksi di HP
  yang belum masuk pusat. Semakin lama menganggur, semakin perlu ditanyakan.

**Jadikan halaman ini langkah pertama setiap pagi.**

### 5.3 Buka Tutup

Riwayat buka/tutup toko semua cabang: kas awal, kas akhir, selisih, siapa yang
membuka/menutup, dan kapan.

Perhatikan label status:

- **Buka** / **Tutup** — status shift.
- **Angka pasti** — hitungan sudah lengkap, selisihnya boleh dipercaya.
- **Angka sementara** — masih menunggu sebagian data dari perangkat. Selisihnya
  belum ikut dijumlahkan; angka bisa berubah.

Saring dengan **Kedai** dan rentang tanggal, lalu tekan **Saring**.

### 5.4 Setoran

Tempat pemilik **menyelesaikan selisih kas**. Setiap kartu menampilkan:

- **Kas awal**, **Setoran kasir** (uang yang dihitung kasir), **Kas
  seharusnya**, dan **Selisih**.
- **Selisih stok** per produk: **Di sistem**, **Hitung kasir**, **Terjual**,
  **Rusak/buang**, dan **Selisih**.
- **Status selisih** untuk diputuskan pemilik:
  - **Terbuka** — belum ditindaklanjuti.
  - **Sudah dijelaskan** — selisih sudah ada penjelasannya (mis. salah kembalian).
  - **Dihitung sebagai rugi** — diakui sebagai kerugian.
- **Catatan keputusan** — tulis penjelasannya di sini.
- Tekan **Simpan Status**.

Halaman ini menampilkan penutupan terbaru yang datanya sudah lengkap (**Angka
pasti**). Penutupan dengan selisih nol tetap tampil di sini; yang **otomatis
hilang dari daftar pantauan** adalah yang muncul di **Perlu Perhatian → Kas
belum dibereskan**.

### 5.5 Pembatalan

Daftar pengajuan pembatalan transaksi yang menunggu keputusan Anda. Tiap kartu
menampilkan nomor transaksi, kedai, kasir, waktu, total, dan **alasan kasir**.

- **Setujui & Batalkan** — transaksi dibatalkan, stok dikembalikan, nilainya
  keluar dari omzet.
- **Tolak** — wajib menulis **Alasan penolakan**, lalu **Tolak & Simpan**.
  Transaksi tetap sah.

Periksa **rasio pembatalan per karyawan** di [Laporan Harian](#5111-ringkasan-harian)
untuk melihat siapa yang sering membatalkan.

### 5.6 Mutasi

Halaman ini punya dua bagian.

**Atas — Assign dari Gudang.** Kirim stok produk jadi dari gudang pusat ke
kedai: pilih **Produk**, **Kedai tujuan**, isi **Jumlah**, lalu tekan
**Assign**. Mutasi ini **langsung disetujui** (tidak perlu diputuskan lagi).

**Bawah — daftar pengajuan pindah stok antar kedai.** Saring dengan **Status**
(Menunggu / Disetujui / Ditolak / Semua).

- **Setujui** — stok berpindah utuh dalam satu langkah (kedai asal berkurang,
  kedai tujuan bertambah, jejaknya tercatat). Kalau stok kedai asal kurang,
  persetujuan ditolak otomatis.
- **Tolak** — wajib menulis **Alasan penolakan**.

### 5.7 Stok

Pantau stok produk jadi per kedai. Pilih kedai lewat kolom **Kedai**.

- Status tiap produk: **Aman** / **Menipis** / **Habis** / **Minus**, plus
  penanda **belum diatur** bila stok kedai itu belum pernah diisi.
- **Atur** — memperbaiki angka stok. Isi **Jumlah stok sekarang** dan **Alasan**
  (wajib, contoh: *"stok opname bulanan"*).
- **Riwayat** — melihat semua pergerakan stok produk itu: penjualan, pembatalan,
  mutasi masuk/keluar, penyesuaian, beserta saldo setelah tiap perubahan.

Di bagian atas ada tautan ringkasan **Stok bahan mentah (gudang)** yang
menunjukkan berapa bahan yang habis dan menipis, serta pintasan ke halaman
**Bahan Mentah**. Untuk memindahkan stok jadi dari gudang ke kedai, gunakan
**Assign dari Gudang** di halaman [Mutasi](#56-mutasi).

> Stok boleh minus dan itu disengaja: kasir harus tetap bisa menjual saat
> perangkat offline memakai data yang sedikit basi.

### 5.8 Bahan Mentah

Stok bahan baku di gudang pusat (tepung, gula, susu, dll.).

- **Tambah Bahan** — menambah jenis bahan baru ke katalog (nama, satuan, harga
  beli per satuan).
- **Stok** — menambah jumlah bahan yang baru dibeli.
- **Koreksi** — memperbaiki angka stok; **wajib** menulis alasan.
- **Riwayat** — jejak semua penambahan/koreksi beserta saldo setelahnya.
- **Ubah** / **Nonaktifkan** — mengubah data atau menyembunyikan bahan yang
  tidak dipakai lagi.

Status menipis/habis memakai ambang yang sama seperti stok kedai.

### 5.9 Produksi

Mencatat bahan mentah diolah menjadi barang jadi di gudang pusat.

1. Pilih **Produk yang dibuat** dan isi **Jumlah hasil**.
2. Tambahkan baris **Bahan** yang dipakai beserta **Jumlah**-nya. Tekan
   **Tambah bahan** untuk baris tambahan, ikon tong sampah untuk menghapus.
3. Isi **Catatan** bila perlu (opsional).
4. Tekan **Catat Produksi**.

Bahan otomatis dicek cukup dan dikurangi, hasilnya masuk ke stok gudang pusat —
semuanya dalam satu langkah. **Kalau salah satu bahan kurang, produksi ditolak
seluruhnya** (tidak ada yang setengah jadi).

Riwayat produksi tampil di bawah form.

### 5.10 Pengeluaran

Mencatat biaya operasional per kedai (bahan baku, listrik, sewa, gaji, lainnya).

1. Tekan **Catat Biaya**.
2. Pilih **Kedai**, **Kategori**, isi **Deskripsi**, **Jumlah**, dan **Tanggal**.
3. Kalau uang diambil dari **laci kas** saat kedai sedang buka, centang
   **"Diambil dari laci kas"** lalu pilih **Jam kerja**-nya. Pengeluaran ini
   otomatis dikurangi dari hitungan kas saat penutupan.
4. Tekan **Simpan**.

Salah catat? Cukup tekan ikon tong sampah pada barisnya — **Hapus**. Ini tidak
memengaruhi catatan lain. Gunakan filter **Kedai** + **Dari/Sampai tanggal**
untuk melihat rekap per periode.

### 5.11 Laporan

Tiga laporan, masing-masing punya halaman sendiri:

#### 5.11.1 Ringkasan Harian

Omzet, jumlah transaksi, **Dibatalkan**, **Menunggu keputusan**, dan **Kas belum
beres** per tanggal × kedai. Angka-angka ini sengaja dipisah supaya penjualan
yang dibatalkan tidak tercampur ke omzet. **Gudang pusat tidak ikut muncul** di
sini — gudang bukan gerai penjualan.

Di bawahnya ada **Rasio pembatalan per karyawan** — persentase transaksi yang
dibatalkan tiap kasir. Rasio tinggi (≥25% kuning, ≥50% merah) perlu ditanyakan.
Hanya kasir yang punya pembatalan yang muncul.

#### 5.11.2 Laporan Stok

**Laporan Stok Konsolidasi**: satu baris per produk, satu kolom per kedai aktif,
plus **Total** unit dan status **Ada habis / Menipis / Aman**. Sel kuning =
stok di bawah ambang menipis kedai itu, merah = habis (0). Ringkasannya:
**SKU aktif**, **Menipis / habis**, dan **Total unit**. Bisa diunduh sebagai
CSV lewat tombol ekspor.

Catatan: mutasi yang belum disetujui belum tercermin di sini. **Gudang pusat
tetap tampil** di laporan ini (sebagai kolom) karena gudang memang menyimpan
stok jadi sebelum dikirim ke cabang.

#### 5.11.3 Untung-Rugi

**Untung-Rugi Kasar** per kedai: Omzet − Pengeluaran = Selisih, dengan status
**Untung / Impas / Rugi**. Bisa disaring per rentang tanggal dan diunduh sebagai
CSV lewat tombol ekspor. **Gudang pusat tidak dihitung** di sini — kecuali ada
biaya yang benar-benar dicatat atas nama gudang, maka barisnya ikut muncul agar
biaya itu tidak hilang.

> Ini **laba-rugi kasar**: belum memperhitungkan nilai persediaan, penyusutan
> aset, maupun pajak.

### 5.12 Perbandingan Kedai

Halaman perbandingan omzet antar cabang pada rentang tertentu, untuk melihat
cabang mana yang tumbuh dan mana yang perlu perhatian. Dibuka lewat tautan
**Perbandingan kedai** di Dashboard. **Gudang pusat tidak ikut dibandingkan**.

### 5.13 Kedai

Kelola daftar cabang.

- **Tambah Kedai** — isi nama, alamat, telepon, zona waktu, ambang stok
  menipis, dan tandai **Gudang pusat** bila kedai ini menjadi gudang bahan baku.
- **Ubah** — mengubah data cabang.
- **Nonaktifkan** / **Aktifkan** — menutup/membuka cabang tanpa menghapusnya.

> **Kedai tidak bisa dihapus, hanya dinonaktifkan.** Transaksi dan stok lama
> tetap menunjuk ke kedai itu, dan riwayatnya harus tetap utuh.

> **Wajib ada satu "Gudang pusat".** Tanpa itu, menu Bahan Mentah dan Produksi
> akan menampilkan peringatan dan tidak bisa dipakai.

### 5.14 Produk

Katalog barang yang dijual: **Nama produk**, **Harga** (RM, tanpa titik/koma),
**Kategori** (boleh dikosongkan; untuk mengelompokkan produk di layar kasir),
**Gambar** (JPG/PNG/WebP maksimal 2 MB), dan status aktif.

Tombol **Tambah Produk** / **Ubah** / **Nonaktifkan** bekerja seperti di Kedai.
Gambar yang salah bisa dihapus dengan **Hapus gambar** sebelum menyimpan.

### 5.15 Karyawan

Kelola akun karyawan kedai (tanpa email/password — mereka masuk lewat kartu QR).

- **Tambah Karyawan** — isi nama, pilih **Kedai**, dan **Peran** (Kasir /
  Kepala Kedai).
- **Kartu QR** — membuka halaman kartu untuk dicetak/ditampilkan ke karyawan.
- **Kartu Baru** — menerbitkan QR baru. **Kartu lama langsung berhenti
  berlaku.** Pakai kalau kartu hilang atau dicurigai disalin orang.
- **Ubah** / **Nonaktifkan** — mengubah data atau menghentikan akses karyawan.

> Karyawan tidak bisa dihapus — hanya dinonaktifkan, supaya transaksi dan
> shift lamanya tetap merujuk ke orang yang benar.

---

## 6. Pertanyaan yang sering muncul

**Internet mati, apakah tetap bisa jualan?**
Bisa, untuk pembayaran **Tunai**. Transaksinya disimpan di HP dan dikirim
otomatis saat online. **QRIS tidak bisa** tanpa internet.

**Kenapa stok tertulis minus?**
Karena perangkat kedai memakai data yang sedikit basi (mis. penjualan dari HP
lain belum masuk). Ini normal. Sistem sengaja tidak memblokir penjualan. Angka
akan terkoreksi setelah semua data tersinkron.

**Saya salah mencatat penjualan, bagaimana membatalkannya?**
Kasir mengajukan pembatalan lewat menu **Riwayat** (saat toko buka). Pemilik
menyetujui/menolak di menu **Pembatalan**. Stok baru kembali setelah disetujui.

**Kenapa selisih kas saya belum dianggap final?**
Karena masih ada **antrian belum terkirim** dari perangkat kedai. Selisih
dihitung ulang otomatis begitu semua transaksi masuk.

**Kartu QR karyawan hilang.**
Buka **Karyawan → Kartu Baru** untuk orang itu. Kartu lama otomatis mati.
Jangan lupa cetak/tampilkan kartu barunya.

**Apakah data bisa dihapus?**
Transaksi, kedai, produk, bahan, dan karyawan **tidak bisa dihapus**, hanya
dinonaktifkan/dibatalkan — ini disengaja agar riwayat tidak bisa dihilangkan.
Hanya **pengeluaran** yang boleh dihapus permanen, dan **gambar produk** yang
boleh diganti/dihapus.

---

## 7. Ringkasan hak akses

| Tindakan | Karyawan (Kasir) | Pemilik / Admin Pusat |
|---|---|---|
| Jual barang (tunai/QRIS) | ✅ | — |
| Buka & tutup toko | ✅ | — |
| Catat waste & hitung fisik | ✅ | — |
| Ajukan pindah stok | ✅ | — |
| Ajukan pembatalan transaksi | ✅ | — |
| Setujui pembatalan | ❌ | ✅ |
| Setujui mutasi stok | ❌ | ✅ |
| Atur stok / assign dari gudang | ❌ | ✅ |
| Kelola bahan, produksi, pengeluaran | ❌ | ✅ |
| Lihat laporan, selisih kas, omzet | ❌ | ✅ |
| Kelola kedai, produk, karyawan | ❌ | ✅ |
