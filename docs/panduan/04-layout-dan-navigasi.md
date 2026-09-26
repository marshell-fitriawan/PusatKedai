# 04 — Layout & Navigasi

## Apa Ini

Kerangka tampilan dua jenis pengguna: dashboard admin di layar lebar, dan kasir di HP. Beserta cara rute diorganisir.

## Peta Rute

```
/                       Pilih mode (sementara, sampai auth QR selesai)
/admin                  → redirect ke /admin/dashboard
/admin/login            Login admin (tanpa sidebar)
/admin/dashboard        ┐
/admin/kedai            │
/admin/produk           │
/admin/stok             │  Semua pakai sidebar,
/admin/mutasi           │  semua wajib login admin
/admin/karyawan         │
/admin/shift            │
/admin/pengeluaran      │
/admin/laporan          ┘
/pos                    → redirect ke /pos/kasir
/pos/kasir              ┐
/pos/stok               │  Semua pakai bottom nav
/pos/riwayat            │
/pos/shift              ┘
/dev/ui                 Preview komponen
/offline                Fallback saat tidak ada koneksi
```

## Kenapa `/admin/*` dan `/pos/*`, Bukan Route Group

Rencana awal memakai `app/(admin)/` dan `app/(pos)/`. Itu **tidak bisa jalan**.

Route group (folder berkurung) mengelompokkan file **tanpa menambah segmen URL**. Jadi:

```
app/(admin)/stok/page.tsx  →  /stok
app/(pos)/stok/page.tsx    →  /stok    ← bentrok, build gagal
```

Padahal dua halaman stok itu memang berbeda: admin melihat semua kedai, kasir hanya kedainya sendiri.

Solusinya segmen URL nyata. Efek sampingnya menguntungkan: middleware auth bisa membedakan jenis pengguna cukup dari prefix path (`/admin/*` pakai Supabase Auth, `/pos/*` nanti pakai sesi QR), tanpa perlu mencocokkan daftar path satu per satu.

> Route group tetap dipakai di `app/admin/(dashboard)/` — di situ tujuannya memisahkan halaman ber-sidebar dari halaman login, dan tidak ada URL yang bertabrakan.

## Layout Admin

`components/admin/admin-shell.tsx`

| Lebar layar | Tampilan |
|---|---|
| ≥ 768px (`md`) | Sidebar tetap di kiri, 256px |
| < 768px | Header dengan tombol menu, sidebar jadi drawer |

Drawer memakai elemen `<dialog>` bawaan browser — jadi tombol Esc, kunci scroll latar, dan *focus trap* ditangani browser, bukan kode kita. Implementasi manual untuk hal ini hampir selalu bocor aksesibilitasnya.

Bagian bawah sidebar menampilkan nama admin yang login dan tombol Keluar. Tombol itu dibungkus `<form action={logout}>`, bukan `onClick` — supaya tetap berfungsi walau JavaScript belum termuat.

### Jebakan: jangan tutup drawer lewat useEffect

Versi pertama menutup drawer dengan effect yang memantau `pathname`:

```tsx
// ❌ ditolak lint: react-hooks/set-state-in-effect
useEffect(() => { setOpen(false); }, [pathname]);
```

Selain dilarang lint, ini memicu render tambahan setiap pindah halaman. Yang benar: tutup di handler `onClick` link, yang memang sudah ada (`onNavigate`).

## Layout POS

`components/pos/bottom-nav.tsx`

Bottom navigation, bukan sidebar. Alasannya fisik: kasir memegang HP satu tangan, dan navigasi harus berada dalam jangkauan ibu jari. Maksimal 4–5 item — lebih dari itu tiap target jadi terlalu sempit untuk dipencet cepat.

Empat item: Kasir, Stok, Riwayat, Shift.

Dua detail yang wajib dipertahankan:

```tsx
// 1. Nav tidak tertutup gesture bar iOS/Android
className="pb-[env(safe-area-inset-bottom)]"

// 2. Konten diberi ruang bawah, kalau tidak item terakhir
//    daftar transaksi tersembunyi di balik nav
<main className="pb-20">
```

Poin kedua terlihat sepele tapi efeknya nyata: kasir tidak bisa menekan item terakhir di keranjang, dan tidak akan paham kenapa.

## Halaman Placeholder

Sembilan halaman admin dan empat halaman POS masih memakai `components/ui/page-placeholder.tsx`. Masing-masing menyebut task mana yang akan mengisinya.

```tsx
<PagePlaceholder
  title="Kedai"
  task="M1-3"
  description="Daftar cabang: tambah, ubah, dan nonaktifkan kedai."
/>
```

Sengaja **tidak** menampilkan data contoh yang terlihat asli. Di aplikasi kasir, angka palsu yang tampak nyata lebih berbahaya daripada halaman kosong yang jujur — orang bisa mengira sistemnya sudah jalan.

Saat mengerjakan sebuah halaman, ganti `PagePlaceholder` dengan isi sesungguhnya.

## Menambah Halaman Baru

Halaman admin baru:

1. Buat `app/admin/(dashboard)/<nama>/page.tsx`
2. Tambahkan item ke array `items` di `components/admin/admin-shell.tsx`
3. Selesai — proteksi login otomatis ikut, karena berasal dari layout

Halaman POS baru:

1. Buat `app/pos/<nama>/page.tsx`
2. Kalau perlu masuk nav, tambahkan ke `items` di `bottom-nav.tsx` — **tapi jaga maksimal 5**

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| Build gagal: "You cannot have two parallel pages that resolve to the same path" | Dua file menghasilkan URL sama | Cek route group yang tidak menambah segmen |
| Halaman admin baru bisa diakses tanpa login | File diletakkan di `app/admin/` bukan `app/admin/(dashboard)/` | Pindahkan ke dalam `(dashboard)` |
| Item terakhir daftar tidak bisa ditekan di HP | `pb-20` hilang dari `<main>` | Kembalikan padding bawahnya |
| Nav aktif tidak menyala | Path tidak cocok persis | Cek logika `pathname.startsWith()` di komponen nav |
| Sidebar muncul di halaman login | Login berada di bawah layout `(dashboard)` | Pastikan `app/admin/login/` di luar folder itu |

## Istilah

- **Route group** — folder berkurung `(nama)`, mengelompokkan tanpa mengubah URL.
- **Layout** — komponen pembungkus yang dipakai bersama beberapa halaman; tidak ikut render ulang saat pindah halaman di dalamnya.
- **Safe area inset** — area layar HP yang tertutup notch atau gesture bar.
- **Focus trap** — mengunci fokus keyboard di dalam dialog supaya Tab tidak nyasar ke latar.
