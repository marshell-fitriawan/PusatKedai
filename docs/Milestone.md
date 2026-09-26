# Milestone/Task.md — Roadmap (Sistem Multi-Kedai)

Tidak ada deadline pasti — milestone disusun berdasarkan urutan logis pembangunan, bukan tanggal kalender. Setiap milestone dianggap selesai kalau semua task-nya checked.

Rincian per task (dependensi, estimasi, output file, Definition of Done) ada di `Tasks.md`. Dokumen ini adalah ringkasan level milestone.

## Milestone 0 — Setup & Fondasi
- [ ] Setup repo template Next.js + TypeScript + Tailwind (dengan token warna/font dari `design_1.md` sudah masuk `tailwind.config`)
- [ ] Setup project Supabase (Postgres + Auth) untuk environment development
- [ ] Implementasi skema database awal dari `Database.md` (migrations), termasuk tabel ledger `stock_movements` dan constraint idempotensinya
- [ ] Setup Supabase Auth untuk admin (email/password)
- [ ] Setup PWA dasar (manifest, service worker kosong) supaya bisa di-"install" dari HP

## Milestone 1 — Kasir/POS Inti (Online dulu, offline menyusul)
- [x] Halaman login admin (email/password)
- [x] CRUD produk sederhana (nama, harga, kategori, gambar) — admin pusat
- [x] Halaman kasir: grid produk, tambah ke keranjang, hitung total
- [x] Simpan transaksi ke `transactions` + `transaction_items`
- [x] Penomoran transaksi: `local_number` dibuat device, `transaction_number` final ditetapkan server per kedai per `business_date`
- [x] Pilihan metode bayar: tunai, QRIS (integrasi Midtrans untuk QRIS)
- [x] Riwayat transaksi per kedai (list sederhana)

## Milestone 2 — Offline-First untuk Kasir
- [ ] Setup IndexedDB (Dexie.js) sebagai local queue transaksi
- [ ] Buat transaksi tetap bisa disimpan lokal saat tidak ada koneksi
- [ ] Background sync: kirim antrian transaksi ke server saat online kembali
- [ ] Idempotency check (transaction id UUID) supaya tidak dobel saat retry sync
- [ ] Indikator visual status "belum sync" vs "tersimpan" di UI kasir
- [ ] Testing skenario: offline penuh, offline-lalu-online, koneksi putus di tengah sync

## Milestone 3 — Karyawan, Shift & Absensi
- [x] CRUD karyawan per kedai (admin pusat/admin kedai) + generate QR token unik per karyawan
- [x] Halaman scan QR untuk absen (clock-in/clock-out)
- [x] Alur buka toko: input kas awal, mulai shift
- [x] Alur tutup toko: input kas akhir (hitung fisik), sistem hitung `expected_cash` dan `cash_difference`
- [x] Tutup toko saat masih ada antrian offline: shift ditutup dengan status `pending_sync`, server hitung ulang kas sampai `final`
- [x] Kaitkan setiap transaksi ke shift yang sedang berjalan
- [x] Riwayat shift per kedai (lihat selisih kas historis, bedakan yang belum final)

## Milestone 4 — Stok & Mutasi Antar Kedai
- [x] CRUD stok awal per kedai (`kedai_stock`)
- [x] Pengurangan stok otomatis saat transaksi tersimpan (server-side, saat sync) — selalu disertai baris `stock_movements`
- [x] Penyesuaian stok manual (`adjustment`) dengan alasan wajib, sebagai satu-satunya cara koreksi stok
- [x] Halaman riwayat pergerakan stok per kedai/produk (audit trail)
- [x] Form pengajuan mutasi stok antar kedai (`stock_mutations`, status pending)
- [x] Halaman approval mutasi (admin pusat menyetujui/menolak)
- [x] Eksekusi perpindahan stok otomatis setelah approved (atomic, idempotent)
- [x] Tampilan stok per kedai dengan indikator stok menipis dan stok minus (visual saja, tanpa notifikasi push)

## Milestone 5 — Laporan Pusat & Pengeluaran
- [x] Input pengeluaran per kedai (`expenses`) — kategori, jumlah, tanggal
- [x] Dashboard omzet per kedai (harian/mingguan/bulanan)
- [x] Perbandingan performa antar kedai (grafik/tabel side-by-side)
- [x] Laporan stok konsolidasi semua kedai
- [x] Ringkasan untung-rugi kasar (omzet − pengeluaran) per kedai

## Milestone 6 — Polish & Persiapan Deploy Klien Pertama
- [ ] Review UI menyeluruh terhadap `design_1.md` (konsistensi warna, spacing, komponen)
- [ ] Setup Sentry untuk error tracking
- [ ] Dokumentasi setup instance baru (checklist provisioning Supabase + Vercel per klien)
- [ ] Testing end-to-end: buka toko → transaksi (online & offline) → tutup toko → cek laporan pusat
- [ ] Deploy instance pertama untuk klien pilot

## Backlog (Sengaja Ditunda, Bukan Dihapus)
- Cetak struk fisik (printer thermal/ESC-POS)
- Pajak/PPN otomatis
- Varian produk & resep/BOM
- Self-order via QR meja untuk pelanggan
- Sistem notifikasi (push/in-app)
- Dark mode
- Evaluasi payment gateway kedua (Xendit)
