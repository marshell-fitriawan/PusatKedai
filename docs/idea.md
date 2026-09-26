# Idea.md — Sistem Multi-Kedai

## Working Title
**Sistem Multi-Kedai** (belum ada nama produk final, dokumen ini akan diperbarui begitu nama ditentukan)

## Problem
Bisnis F&B yang punya beberapa cabang (kedai) biasanya kesulitan memantau operasional tiap cabang secara real-time: pemilik tidak tahu omzet harian tiap kedai tanpa menunggu laporan manual, stok antar kedai sering tidak sinkron, dan tidak ada kontrol terpusat atas mutasi barang atau kinerja karyawan per shift.

## Solusi
Sistem manajemen multi-cabang berbasis web, mobile-first (kasir dioperasikan lewat HP), yang menyatukan 4 fungsi inti dalam satu sistem:
1. **Kasir/POS** — pencatatan transaksi penjualan per kedai
2. **Stok/Inventori** — tracking stok per kedai + mutasi antar kedai dengan approval
3. **Laporan Pusat** — dashboard konsolidasi omzet, performa antar kedai, stok, dan pengeluaran
4. **Karyawan & Shift** — absensi, buka/tutup toko dengan rekonsiliasi kas

## Target Pasar
Bisnis F&B skala menengah — franchise kecil dengan **4–10 cabang**. Bukan pasar UMKM mikro (1 kedai), dan bukan enterprise besar (puluhan cabang) di tahap awal.

## Model Bisnis
Dijual **manual per klien**, bukan self-serve SaaS publik. Setiap klien mendapat **instance/deployment terpisah** yang bisa di-*tuning* sesuai kebutuhan spesifik mereka (harga, fitur aktif, branding ringan). Ini bukan multi-tenant shared database — satu deployment = satu bisnis (dengan banyak kedai di dalamnya).

## Prioritas MVP
Rilis versi tipis dari **keempat modul sekaligus**, bukan satu modul penuh dulu. Tujuannya supaya klien pertama bisa langsung memakai alur kerja end-to-end (buka toko → transaksi → tutup toko → owner lihat laporan), meski tiap modul belum lengkap fitur-fiturnya.

### Cakupan MVP
- Kasir HP-first, **wajib offline-first** (transaksi tetap jalan tanpa internet, sync otomatis saat online kembali)
- Pembayaran: **tunai** dan **QRIS/e-wallet** (via payment gateway)
- Produk sederhana, **tanpa varian/modifier**
- **Tanpa** cetak struk fisik (belum ke arah hardware printer)
- **Tanpa** perhitungan pajak/PPN otomatis
- Karyawan: absensi clock-in/out via **QR unik per karyawan**, buka/tutup toko dengan **hitung kas awal & akhir** (rekonsiliasi)
- Stok: satuan **pcs/unit saja** (tanpa konversi satuan/resep), mutasi antar kedai **wajib melalui approval**
- Laporan pusat: omzet per kedai, perbandingan performa antar kedai, laporan stok, **pencatatan pengeluaran** (untuk gambaran untung-rugi, bukan cuma omzet kotor)
- **Tanpa** sistem notifikasi push/in-app di MVP
- **Tanpa** self-order/menu digital untuk pelanggan (semua order diinput kasir)
- Login: **admin pakai email/password**, **kasir/karyawan pakai QR pribadi**

### Di luar cakupan MVP (dipertimbangkan untuk versi berikutnya)
- Cetak struk fisik (printer thermal/ESC-POS)
- Pajak/PPN otomatis
- Varian produk & resep/BOM
- Self-order via QR meja
- Notifikasi push (stok menipis, approval pending)
- Dark mode
- Multi-currency

## Kenapa Ini Bisa Berhasil
Fokus sempit (F&B menengah, 4–10 cabang) menghindari over-engineering untuk skala yang belum dibutuhkan klien pertama. Model jual manual + instance per klien juga berarti tidak perlu membangun sistem multi-tenant yang kompleks di awal — kompleksitas ditambahkan hanya kalau memang ada permintaan nyata dari klien.
