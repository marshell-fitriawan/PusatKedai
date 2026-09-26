# Alur Kerja Harian

Checklist yang dijalankan **setiap hari**. Cetak dan tempel di kedai bila
perlu. Untuk penjelasan tiap tombol, lihat [Manual Book](README.md).

Dua peran, dua alur:

- [**A. Karyawan Kedai**](#a-karyawan-kedai) — pembuka & penutup toko, kasir.
- [**B. Pemilik / Admin Pusat**](#b-pemilik--admin-pusat) — pemantauan pagi,
  pemeriksaan siang, penyelesaian malam.

Prinsip yang berlaku untuk keduanya: **catat saat itu juga, jangan menunda**.
Menunda membuat selisih kas dan selisih stok terlihat seperti kehilangan.

---

## A. Karyawan Kedai

### Pagi — sebelum buka

- [ ] **1. Masuk ke pintu Kasir.** Scan kartu QR (atau ketik kodenya). Pastikan
      nama Anda dan nama kedai yang benar muncul di bagian atas.
- [ ] **2. Cek perangkat.** Kalau ada bilah kuning *"N transaksi gagal
      terkirim"*, tekan **Coba lagi** sebelum mulai. Pastikan HP/tablet
      tercharge.
- [ ] **3. Hitung kas awal.** Buka menu **Shift**, hitung uang fisik di laci,
      ketik di **Kas awal**, tekan **Buka Toko**.
- [ ] **4. Pastikan toko sudah terbuka.** Layar Kasir tidak lagi menampilkan
      peringatan *"Toko belum dibuka"*.

### Sepanjang hari — melayani pelanggan

- [ ] **5. Jual seperti biasa** di menu **Kasir**: cari/ketuk produk → **Lihat
      Keranjang** → pilih **Tunai** atau **QRIS** → **Bayar**.
- [ ] **6. Untuk QRIS**, tunggu sampai muncul **Transaksi Berhasil** sebelum
      melepas pelanggan. Jangan tekan Batal setelah pelanggan memindai.
- [ ] **7. Catat barang rusak/tumpah saat kejadian.** Menu **Shift → Stok Hilang
      (Waste)**: pilih produk, isi jumlah dan alasan, tekan **Catat Waste**.
- [ ] **8. Salah input?** Ajukan pembatalan lewat menu **Riwayat** → pilih
      transaksi → isi **Alasan pembatalan** → **Ajukan Pembatalan** → **Kirim
      Pengajuan**. Ingat: ini menunggu keputusan pemilik, stok belum kembali.
- [ ] **9. Stok menipis?** Ajukan lewat menu **Stok → Pindah Stok**. Butuh
      persetujuan pemilik.
- [ ] **10. Kalau internet mati**, tetap jualan **Tunai** seperti biasa.
      Transaksi tersimpan di perangkat dan terkirim otomatis saat online.

### Tutup toko — setelah pelanggan terakhir

- [ ] **11. Hitung fisik sisa stok.** Menu **Shift → Hitung Fisik Sisa Stok**.
      Hitung barang sungguhan di rak; ubah angka yang berbeda, isi `0` bila
      habis. Tekan **Simpan Hitungan**.
- [ ] **12. Tutup toko.** Masih di menu **Shift**, tekan **Tutup Toko**, isi
      **Kas fisik di laci** dengan uang sungguhan, lalu **Tutup Toko** lagi.
- [ ] **13. Baca pesan hasil.** Kalau muncul **"Belum final"**, berarti masih
      ada transaksi yang belum terkirim. **Biarkan HP menyala dan tersambung
      internet** beberapa saat supaya antrian habis — selisih kas baru final
      setelah semuanya masuk.
- [ ] **14. Serahkan uang laci** sesuai prosedur kedai (kas awal dikembalikan,
      sisanya disetor) dan **keluar dari aplikasi** (tombol keluar di header).

---

## B. Pemilik / Admin Pusat

### Pagi — pemeriksaan cepat (5 menit)

- [ ] **1. Masuk ke pintu Admin Pusat** dengan email dan password Anda.
- [ ] **2. Buka Dashboard.** Lihat sekilas **Omzet** dan **Selisih** kemarin
      (atur **Dari/Sampai** ke hari kemarin, tekan **Tampilkan**).
- [ ] **3. Buka Perlu Perhatian.** Ini bagian terpenting:
  - [ ] Baca **Notifikasi** yang belum dibaca.
  - [ ] Periksa **Kas belum dibereskan** — catat kedai dan tanggalnya untuk
        diselesaikan (lihat langkah 9).
  - [ ] Periksa **Antrian belum terkirim** — kalau ada yang menganggur lama,
        hubungi karyawan kedai untuk menyalakan dan menyambungkan perangkat.
- [ ] **4. Cek stok kritis.** Buka **Stok** per kedai dan **Bahan Mentah**;
      perhatikan label **Menipis**/**Habis**. Rencanakan produksi/pengiriman
      bila perlu.

### Siang — pengelolaan

- [ ] **5. Setujui mutasi yang menunggu.** Menu **Mutasi** → saring
      **Menunggu** → **Setujui** atau **Tolak** (tulis alasan bila menolak).
- [ ] **6. Putuskan pembatalan yang menunggu.** Menu **Pembatalan** → baca
      **alasan kasir** → **Setujui & Batalkan** atau **Tolak** (tulis alasan
      penolakan).
- [ ] **7. Catat pengeluaran hari ini.** Menu **Pengeluaran → Catat Biaya**.
      Kalau uang diambil dari laci kas saat kedai buka, centang **"Diambil dari
      laci kas"** dan pilih jam kerjanya.
- [ ] **8. Jalankan produksi bila stok gudang perlu diisi.** Menu **Produksi**:
      pilih produk, isi hasil, tambahkan bahan yang dipakai, tekan **Catat
      Produksi**. Lalu kirim ke kedai lewat **Mutasi → Assign dari Gudang**.

### Malam — penyelesaian & penutupan buku

- [ ] **9. Selesaikan setoran tiap kedai.** Menu **Setoran** → untuk setiap
      kartu: bandingkan **Kas awal**, **Setoran kasir**, dan **Kas seharusnya**;
      periksa **selisih kas** dan **selisih stok** per produk. Pilih **Status
      selisih** (Terbuka / Sudah dijelaskan / Dihitung sebagai rugi), tulis
      **Catatan keputusan**, tekan **Simpan Status**. Ulangi sampai daftar
      **Kas belum dibereskan** di Perlu Perhatian kosong.
- [ ] **10. Baca Ringkasan Harian.** Menu **Laporan → Ringkasan Harian**: cek
      omzet, jumlah **Dibatalkan**, dan **Menunggu keputusan** hari ini. Periksa
      **Rasio pembatalan per karyawan** — rasio kuning/merah perlu ditanyakan.
- [ ] **11. Periksa Buka Tutup.** Menu **Buka Tutup**: pastikan semua kedai
      benar-benar **Tutup** hari ini. Yang masih **Buka** berarti karyawan lupa
      menutup — hubungi.
- [ ] **12. Cek omzet vs pengeluaran.** Menu **Laporan → Untung-Rugi** untuk
      rentang minggu/bulan berjalan; unduh CSV bila perlu diarsipkan.
- [ ] **13. Pastikan tidak ada antrian menggantung.** Buka kembali **Perlu
      Perhatian**; kalau masih ada **Antrian belum terkirim** dari penutupan
      hari ini, koordinasikan dengan kedai agar perangkatnya tersambung sampai
      antrian habis — besok pagi angkanya baru bisa dipercaya.

### Mingguan — opsional

- [ ] **14. Stok opname.** Bandingkan hitungan fisik dengan sistem di menu
      **Stok** (per kedai) dan **Bahan Mentah**; lakukan **Atur**/**Koreksi**
      dengan alasan *"stok opname mingguan"*.
- [ ] **15. Tinjau Perbandingan Kedai** untuk melihat cabang yang tumbuh dan
      yang perlu perhatian.

---

## Ringkasan satu layar

| Waktu | Karyawan Kedai | Pemilik / Admin Pusat |
|---|---|---|
| **Pagi** | Masuk QR → cek antrian → hitung **Kas awal** → **Buka Toko** | Dashboard → **Perlu Perhatian** → cek stok kritis |
| **Siang** | Jual (Tunai/QRIS) → catat waste → ajukan pembatalan/mutasi bila perlu | Setujui mutasi & pembatalan → catat pengeluaran → produksi |
| **Tutup** | Hitung fisik stok → **Tutup Toko** → pastikan antrian terkirim | Selesaikan **Setoran** → baca **Ringkasan Harian** → cek **Buka Tutup** |
| **Malam** | Keluar dari aplikasi | Pastikan **Kas belum dibereskan** & antrian kosong |
