# Design.md — Panduan Desain UI (Sistem Multi-Kedai)

Dokumen ini murni panduan visual (warna, layout, tipografi, komponen) supaya UI konsisten dan tidak terasa "generic AI slop" (gradient ungu-biru default, border-radius berlebihan tanpa alasan, bayangan/shadow tebal di semua tempat, ikon emoji sebagai pengganti ikon asli). Semua keputusan desain di bawah ini harus dipakai sebagai referensi CSS/Tailwind config, bukan diputuskan ulang per halaman.

**Arah desain: Neo-Brutalism — tema Putih/Kuning** (alternatif biru ada di [Varian Biru](#varian-biru)).

## Prinsip Desain

1. **Fungsional dulu, dekoratif belakangan.** Ini alat kerja harian (kasir, admin gudang), bukan landing page marketing — hierarki visual harus membantu orang bekerja cepat, bukan memamerkan estetika.
2. **Kasar itu disengaja, bukan ceroboh.** Neo-brutalism = border hitam tebal, bayangan offset keras tanpa blur, warna solid mencolok, tipografi tebal. Hasil akhir harus selalu terlihat "cetak", bukan glassy/soft. Tapi kejelasan data tetap nomor satu: angka harus mudah dibaca lebih dulu, baru vibes.
3. **Mobile-first tanpa kompromi.** Kasir dipakai di HP sebagai device utama — semua komponen didesain untuk layar kecil dulu, baru di-scale ke layar besar (dashboard admin/owner).
4. **Konsisten, bukan seragam kaku.** Pakai token desain (warna, border, shadow, spacing) dari daftar di bawah — jangan pakai nilai baru di luar token kecuali benar-benar perlu dan ditambahkan ke dokumen ini dulu.

## Aturan Inti Neo-Brutalism (WAJIB)

| Aturan | Nilai |
|---|---|
| Border | `2px` solid `--color-ink` (default), `3px` untuk input/kartu utama, `4px` untuk hero/panel besar |
| Radius | **0** di semua elemen. `rounded-none` default. Boleh `2px` (kecil) untuk badge/chip saja |
| Shadow | Hanya *hard offset* tanpa blur: `4px 4px 0 0 var(--color-ink)`. Varian `2px` (kecil) dan `6px` (besar) |
| Gradien | **Dilarang total** |
| warna solid | Fill solid, tidak ada transparansi pada background komponen (kecuali badge status) |
| Tipografi | Heading `uppercase` + `bold/extrabold`, tracking rapat |
| Latar | Putih polos. Pola garis/dot hanya sebagai aksen dekoratif pada header, bukan pada area data |

Pelanggaran yang paling sering terjadi dan harus dihindari:
- `rounded-lg` / `rounded-full` pada card, tombol, input, modal.
- `shadow-lg`, `shadow-xl`, `drop-shadow`, `blur-*` — tidak ada blur di sistem ini.
- `opacity-*` atau `bg-*/20` pada warna brand di komponen.
- `hover:` yang hanya mengubah warna tanpa menggeser shadow (efek "tekan" wajib ada di elemen interaktif).

## Palet Warna — Putih/Kuning (tema utama)

### Warna Utama (Brand)
| Token | Hex | Penggunaan |
|---|---|---|
| `primary` | `#FFD400` (kuning mencolok) | Tombol utama, elemen aktif, highlight penting |
| `primary-dark` | `#E0B800` | Hover/pressed tombol utama (gelap, bukan transparan) |
| `primary-light` | `#FFF4B8` | Background lembut untuk badge/section aktif |

> Tombol `primary` memakai **teks hitam** (`--color-ink`), bukan putih. Kuning dengan teks putih tidak memenuhi kontras. Aturan ini berlaku untuk semua elemen yang isinya `primary`.

### Warna Netral (UI dasar)
| Token | Hex | Penggunaan |
|---|---|---|
| `background` | `#FFFFFF` | Latar belakang utama halaman (putih polos) |
| `surface` | `#FFFFFF` | Card, modal, form container |
| `surface-alt` | `#F2F2F2` | Baris zebra tabel, area sekunder, header tabel |
| `ink` | `#0A0A0A` | **Garis border utama + warna teks utama.** Semua border brutalism memakai warna ini |
| `text-primary` | `#0A0A0A` | Teks utama (hitam, sama dengan `ink`) |
| `text-secondary` | `#4A4A4A` | Teks sekunder/label/caption |
| `text-disabled` | `#8C8C8C` | Placeholder, teks nonaktif |
| `border` | `#0A0A0A` | Garis pembatas (sama dengan `ink` — brutalism tidak memakai border tipis abu-abu) |

### Warna Aksen
| Token | Hex | Penggunaan |
|---|---|---|
| `accent-blue` | `#2B50F5` | Elemen sekunder yang butuh pemisah dari kuning, link, pilihan aktif |
| `accent-blue-light` | `#DDE3FF` | Background aksen biru yang lembut |

### Warna Semantik (status — WAJIB konsisten, jangan diganti-ganti per fitur)
| Token | Hex | Teks di atasnya | Penggunaan |
|---|---|---|---|
| `success` | `#3DDc84` | `ink` | Transaksi berhasil, approval disetujui, stok cukup |
| `warning` | `#FFD400` | `ink` | Stok menipis, shift belum ditutup, perlu perhatian |
| `danger` | `#FF4B3E` | `ink` | Gagal, selisih kas, stok habis, ditolak |
| `info` | `#2B50F5` | `white` | Notifikasi netral/informasi |

Aturan: warna semantik **tidak boleh dipakai untuk elemen dekoratif** — hanya untuk status yang benar-benar berarti (supaya kasir/karyawan bisa langsung paham dari warna tanpa baca teks). Badge status = isi warna semantik + border `2px ink` + teks sesuai kolom di atas + radius `2px`.

## Varian Biru

Semua token nullable. Untuk pindah ke tema biru, ganti **hanya 5 token** di `app/globals.css`; token lain tetap:

| Token | Hex (putih/kuning) | Hex (putih/biru) |
|---|---|---|
| `primary` | `#FFD400` | `#2B50F5` |
| `primary-dark` | `#E0B800` | `#1E3AD1` |
| `primary-light` | `#FFF4B8` | `#DDE3FF` |
| `accent-blue` | `#2B50F5` | `#FFD400` (kuning jadi aksen) |
| `accent-blue-light` | `#DDE3FF` | `#FFF4B8` |

Catatan varian biru: tombol `primary` berubah jadi biru → teks tombol jadi **putih**. Token status `info` yang tadinya biru berubah jadi kuning (teks `ink`). Semantik lain tidak berubah.

## Tipografi
- **Font heading (display):** **Space Grotesk** atau **Archivo** (bold/extrabold, grotesque) — memberi kesan tegas ala brutalism.
- **Font body/UI:** **Plus Jakarta Sans** (sudah terpasang di `app/layout.tsx` via `--font-plus-jakarta`). Legible di layar kecil, tidak generic.
- **Angka (harga, jumlah stok, laporan):** pakai tabular figures (`font-variant-numeric: tabular-nums`) supaya angka di tabel/daftar transaksi rapi sejajar.
- Skala ukuran (mobile-first, dalam rem):
  | Level | Ukuran | Penggunaan |
  |---|---|---|
  | `xs` | 0.75rem | Caption, label kecil, timestamp |
  | `sm` | 0.875rem | Body sekunder, teks tabel |
  | `base` | 1rem | Body utama |
  | `lg` | 1.125rem | Sub-heading, harga di POS |
  | `xl` | 1.375rem | Heading section |
  | `2xl` | 1.75rem | Heading halaman |
  | `3xl` | 2.25rem | Angka besar, total transaksi, omzet |
- Berat font: `regular` (400) untuk body, `semibold` (600) untuk label penting, `bold` (700) untuk heading, `extrabold` (800) untuk angka besar (total transaksi, omzet) dan judul kartu. Hindari `black`/900 di body text.
- Heading selalu `uppercase` + `tracking-tight`.

## Layout & Spacing
- **Spacing scale (dipakai konsisten untuk margin/padding/gap):** 4, 8, 12, 16, 24, 32, 48, 64 (px). Jangan pakai nilai di luar skala ini.
- **Grid mobile:** 1 kolom penuh dengan padding horizontal 16px. Komponen kasir (grid produk) pakai grid 2 kolom di HP, 3–4 kolom di tablet/desktop admin.
- **Bottom navigation** untuk POS di HP (bukan sidebar) — thumb-reachable, maksimal 4–5 item utama (Kasir, Stok, Riwayat, Profil/Shift). Item aktif = background `primary` + border `2px ink` + shadow `2px 2px 0 0 ink`.
- **Sidebar** hanya muncul di layar lebar (dashboard admin pusat/owner), collapse otomatis di bawah breakpoint tablet.
- Card produk/transaksi: padding 12–16px, border `2px ink`, satu shadow hard saja, tidak bertumpuk border + background beda sekaligus.
- Pemisah antar section memakai **jarak + border**, bukan bayangan kabut. Garis pemisah `2px ink` penuh (bukan abu-abu tipis).

### POS: dua bentuk, satu breakpoint

POS punya dua tata letak, dan beralih di **`lg` (1024px)**:

| | < 1024px (HP, tablet potret) | >= 1024px (tablet landscape, desktop) |
|---|---|---|
| Navigasi | `BottomNav` fixed di bawah | `SideNav` vertikal, sticky |
| Identitas + keluar | `PosHeader` | `SideNav` (footer) |
| Konten | `max-w-lg`, `pb-20` | mengisi sisa ruang, `pb-6` |
| Keranjang | `Modal` (bottom sheet) | panel samping permanen |
| Grid produk | 2–3 kolom | 2 kolom (`lg`) → 4 kolom (`2xl`) |

Tiga aturan yang tidak boleh dilanggar:

1. **Semua pergantian pakai prefixed Tailwind, bukan deteksi viewport di JS.**
   Men-detek viewport di server membuat hydration mismatch; JS yang hanya
   menyembunyikan elemen adalah pemborosan yang CSS sudah tangani.

2. **Di bawah 1024px, layout HP tetap dipakai — tablet potret tidak mendapat
   split tiga kolom.** Sidebar 224px + panel keranjang 320px hanya menyisakan
   224px untuk grid produk di 768px, dan produk jadi mustahil dipencet.
   Tablet POS di meja kasir hampir selalu dipasang landscape, jadi 1024px
   adalah batas yang realistis. Kalau nanti tablet potret jadi target sungguhan,
   pindah ke `@container` query — jangan lewat JS.

3. **Keranjang tidak boleh tampil di dua tempat sekaligus.** Di layar lebar
   panelnya menggantikan bilah ringkasan; bukan допpel. Dua tampilan total
   yang sama hanya membuat kasir ragu angka mana yang benar. Isi dan aksi
   keranjang diekstrak ke `IsiKeranjang` dan `AksiBayar` supaya keduanya
   dirender dari satu sumber — perbaikan tampilan tidak bisa melenceng antara
   modal dan panel.

## Radius & Shadow
- **Border radius: 0.** Exception: badge/chip boleh `2px`. Tidak ada `rounded-md/lg/xl/full` di card, tombol, input, modal, sheet.
- **Shadow: hanya hard offset tanpa blur.** Definisi token:
  | Token | Nilai | Penggunaan |
  |---|---|---|
  | `shadow-brutal-sm` | `2px 2px 0 0 var(--color-ink)` | Badge, chip, tombol kecil, nav item |
  | `shadow-brutal` | `4px 4px 0 0 var(--color-ink)` | Card, tombol, input |
  | `shadow-brutal-lg` | `6px 6px 0 0 var(--color-ink)` | Modal, panel besar |
- Shadow tidak pernah `blur`, tidak pernah berwarna, tidak pernah `inset`.
- **Jangan pakai `shadow-none`.** Ini utility bawaan Tailwind, dan memakainya menarik pipeline compositor yang tidak ada gunanya (lihat bagian Budget Performa). State "tanpa shadow" ditulis dengan **tidak memasang** `shadow-brutal` sama sekali, atau `shadow-brutal` + `press-brutal` yang sudah menangani `:disabled` dan `:active` secara internal.
- **Efek tekan (wajib untuk elemen interaktif):** pakai class `press-brutal`. Utility itu sudah mencakup `:active` (translate 2px + shadow hilang), `:disabled` (tanpa efek), dan durasi 100ms `steps(2, end)` supaya tidak ada animasi halus yang melenceng dari kesan brutalist. Tidak perlu menulis manual `active:translate-x-[2px] active:shadow-none`.

## Komponen Kunci

**Tombol (Button)**
- Primary: background `primary`, teks `ink` (kuning) / `white` (biru), border `2px ink`, radius `0`, shadow `4px 4px 0 0 ink`, padding 12px 20px, font `bold` uppercase.
- Secondary/outline: background `surface`, border `2px ink`, teks `ink`, shadow `2px 2px 0 0 ink`.
- Ghost: tanpa background, tanpa border, tanpa shadow — hanya teks `ink` dengan `underline`.
- Hover: **tidak** mengubah warna, hanya mempertahankan shadow (atau menambah 1px offset kalau sudah ada `active`). Aktif: tombol terdorong 2px ke bawah-kanan, shadow hilang.
- Ukuran minimum tap target: 44x44px (krusial untuk POS di HP — kasir kerja cepat, tidak boleh salah pencet).

**Card Produk (grid kasir)**
- Border `2px ink`, radius `0`, shadow `4px 4px 0 0 ink`, background `surface`.
- Gambar produk (jika ada) rasio 1:1 dengan border bawah `2px ink` (tidak ada rounded image).
- Nama produk `sm` bold `uppercase`, harga `base` bold, tanpa badge dekoratif berlebihan.
- Stok habis: card diberi `surface-alt` + overlay `ink` 8% + label `danger` — bukan hanya teks yang Mengecil.

**Status Badge**
- Persegi/lingkun sangat kecil: radius `2px`, border `2px ink`, background = warna semantik solid, teks = warna teks semantik (lihat tabel palet), font `xs` `bold` `uppercase`, padding 2px 8px. **Bukan** background terang + teks warna (kontras sering buruk di brutalism).

**Tabel Laporan (dashboard owner)**
- Border luar `3px ink`, header row background `surface-alt` + `bold uppercase`, baris dipisah garis `2px ink` (bukan zebra tipis, bukan garis abu-abu).
- Angka rata kanan, teks rata kiri, semua angka `tabular-nums`.

**Form Input**
- Border `2px ink`, radius `0`, background `surface`, tinggi minimum 44px, label di atas input (`sm` bold uppercase, bukan placeholder-as-label yang hilang saat mengetik).
- Focus: **tidak** pakai ring biru default — pakai `outline: 3px solid var(--color-primary)` + `outline-offset: 0`, atau border Thickening. Placeholder `text-disabled`.

**Card/Container Section**
- Latar putih polos. Aksen dekoratif (pola garis/dot kuning) hanya di header halaman, opacity rendah, tidak boleh di belakang teks atau angka.

**Empty State**
- Box bersudut siku dengan border `2px ink` putus-putus (dashed), teks di tengah, tanpa ilustrasi gradients. Ikon lucide ukuran 24px di dalam kotak `primary-light` + border `2px ink`.

## Ikonografi
- Pakai satu set ikon konsisten (rekomendasi: **Lucide Icons** — outline, ringan, gratis). Jangan campur beberapa icon set atau pakai emoji sebagai ikon fungsional.
- Ukuran ikon konsisten: 16px (inline dengan teks kecil), 20px (default UI), 24px (navigasi utama).
- Ikon di dalam tombol diberi `stroke-width` sama dengan weight teks (2px default).

## Dark Mode
Tidak diperlukan untuk MVP (keputusan eksplisit). Token warna di atas ditulis sebagai variabel (CSS custom properties / Tailwind theme) sejak awal supaya dark mode bisa ditambahkan belakangan tanpa refactor besar — tapi implementasinya di luar scope MVP. Dark mode brutalism (hitam + kuning) sebenarnya cocok, tapi tidak dikerjakan sekarang.

## Budget Performa

Bagian ini berisi angka yang **dihitung dari hasil `npm run build`**, bukan
perkiraan. Kalau angka berubah jauh saat ada perubahan design, itu info
berguna — tapi belum tentu regresi.

### Angka saat ini

| Aset | Ukuran | Catatan |
|---|---|---|
| CSS global | 27,5 KB mentah / 6,5 KB gzip / 5,7 KB brotli | Satu file, `@layer` Tailwind v4 |
| Plus Jakarta Sans (latin) | 26,6 KB woff2 | Variable 200–800, preload |
| Space Grotesk (latin) | 21,8 KB woff2 | Variable 300–700, preload |
| **Total font yang diunduh** | **48,4 KB** | Sudah kompresi, tidak dikali jumlah weight |

Hanya subset `latin` yang benar-benar diunduh. `@font-face` untuk cyrillic,
vietnamese, dan latin-ext tetap ikut ter-*emit* ke CSS, tapi `unicode-range`-nya
tidak cocok dengan teks Indonesia sehingga browser melompatinya.

### Tiga aturan yang menjaga angka ini

**1. Tailwind hanya boleh memindai direktori kode.**
`app/globals.css` memakai `source(none)` lalu mendaftarkan `@source` secara
eksplisit. Tanpa itu, Tailwind v4 memindai seluruh repo yang tidak di-gitignore
— termasuk `docs/*.md` dan `AGENTS.md`. Dokumen itu justru berisi daftar class
yang **dilarang** (`shadow-lg`, `blur`, `drop-shadow`, `ring`, `filter`), dan
Tailwind membacanya sebagai permintaan class.

Terbukti: sebelum dibatasi, 10 class yang tidak pernah dipakai ikut terkirim,
termasuk `bg-[#FFD400]` (hex mentah) dan `text-danger` / `text-primary` (token
yang sudah dihapus). Tidak ada satu pun class yang hilang setelah dibatasi —
artinya daftar `@source` sudah lengkap.

> Kalau menambah direktori baru yang mungkin memuat `className`, tambahkan juga
> di daftar `@source`. Kalau lupa, styling hilang tanpa error build.

**2. Shadow brutalist ditulis sebagai `@utility`, bukan token `@theme`.**
Utility `shadow-*` bawaan Tailwind disusun dari compositor internal (ring,
inset, drop-shadow, dan filter warna). Karena itu `shadow-brutal` di
`globals.css` memakai `box-shadow` biasa — hasil visual identik, biaya nol.

Efek sampingnya adalah aturan baru: **dilarang memakai utility filter/shadow
bawaan Tailwind** (`shadow`, `shadow-lg`, `shadow-none`, `blur`, `drop-shadow`,
`ring`, `filter`). Semua filter tersebut tidak ada artinya di brutalism.

Yang perlu diketahui secara jujur: blok `@property` milik compositor itu
**masih terkirim** (2,5 KB mentah, hanya **0,30 KB gzip**), karena extractor
Tailwind memindai seluruh isi file — bukan cuma atribut `className`:
- `filter` ketahuan dari `Array.prototype.filter` yang dipakai di mana-mana
- `shadow` ketahuan dari kata "shadow" di komentar prosa

Menghilangkannya berarti tidak boleh memakai `.filter()` dan tidak boleh
menyebut "shadow" di komentar. Tidak sepadan dengan 0,3 KB, jadi dibiarkan.

**3. Jangan menambah family font ketiga.**
Semua heading sudah `font-display`, body `font-sans`. Menambah font ketiga
melebihi 48,4 KB itu dengan cepat, dan karena dipakai di heading, dampaknya
langsung terasa di area yang paling awal dilihat di layar POS.

### Cara mengukur ulang

```bash
npm run build
# CSS ada di .next/static/chunks/*.css (BUKAN .next/static/css/)
```

Kalau butuh angka gzip/brotli persis, kompres file itu; Tailwind sudah
minify, jadi angka yang comparable adalah setelah kompresi.

Untuk mengecek preloads: di Next.js 16 preloads **tidak** muncul sebagai tag
`<link>` di HTML statis, melainkan sebagai hint `HL[...]` di flight payload
RSC. Cari argumen `"font"` di dalam `HL[...]` — menghitung `rel="preload"` di
string HTML akan selalu menghasilkan nol dan menyesatkan.

### Yang sengaja tidak dioptimasi

- **`content-visibility` untuk tabel panjang.** Secara teori membantu, tapi
  berisiko merusak `position: sticky` pada header dan bikin scrollbar bergetar.
  Tidak diterapkan karena belum bisa diverifikasi tanpa pengujian visual.
- **Menjatuhkan Space Grotesk.** Menghemat 21,8 KB, tapi menghilangkan karakter
  brutalist pada heading. Bukan keputusan teknis, tapi kebijakan produk.

## Resep Class Siap Pakai

Bagian ini rangkuman dari komponen `components/ui/`. Pakai ini kalau sedang
bikin elemen baru dan tidak yakin class mana yang benar -- lebih cepat dan
lebih konsisten daripada menebak sendiri.

```bash
# lihat semua resep yang dipakai app saat ini
rg -o 'border-2 border-ink[^"]*' components app | sort -u
```

| Elemen | Class inti |
|---|---|
| Tombol (semua varian) | `border-2 border-ink font-display font-bold uppercase tracking-tight` + `shadow-brutal press-brutal` |
| Tombol nonaktif | `disabled:border-ink/30 disabled:bg-surface-alt disabled:text-text-disabled` (efek tekan sudah dinonaktifkan `press-brutal`) |
| Card | `border-2 border-ink bg-surface shadow-brutal` |
| Card yang bisa diklik | `... shadow-brutal press-brutal hover:bg-primary-light` |
| Input / Select | `border-2 border-ink bg-surface px-3` + `tap-target` |
| Badge / Chip | `inline-flex items-center gap-1 rounded-sm border-2 border-ink px-2 py-0.5` + warna semantik solid |
| Header tabel | `border-b-2 border-ink bg-surface-alt font-display text-xs font-bold uppercase tracking-tight` |
| Baris tabel | `border-b-2 border-ink tabular-nums` |
| Nav item aktif | `bg-primary border-2 border-ink text-ink shadow-brutal-sm` |
| Panel / Modal | `border-2 border-ink bg-surface shadow-brutal-lg` |
| Teks status di atas putih | `text-success-text` / `text-warning-text` / `text-danger-text` / `text-info-text` |

Dua hal yang mudah terlewat:

- `bg-primary` adalah kuning. Teks di atasnya **harus** `text-ink`.
- Elemen interaktif apa pun yang punya shadow **harus** punya `press-brutal`,
  kalau tidak akan terlihat seperti kotak statis.

## Catatan Implementasi

- Semua token di atas didefinisikan di `@theme` block `app/globals.css` (Tailwind v4 CSS-first), bukan hex code ditulis manual di tiap komponen — supaya konsisten dan gampang diubah sekali di satu tempat.
- Nama class Tailwind yang dihasilkan: `--color-ink` → `border-ink` / `text-ink` / `bg-ink`; `--shadow-brutal` → `shadow-brutal`; `--radius-sm: 2px` → `rounded-sm`.
- **TABRAKAN NAMA:** class `text-primary` = warna brand kuning, BUKAN warna teks utama. Warna teks utama adalah `text-ink`. Tabrakan `text-text-primary` yang ada di versi desain sebelumnya sudah dihapus.
- **Warna solid tidak boleh jadi warna teks di atas putih.** `success`/`warning`/`danger`/`info` dipakai untuk *isi* blok dan badge; untuk teks langsung di atas permukaan putih, pakai varian gelap `text-success-text`, `text-warning-text`, `text-danger-text`, `text-info-text`.
- Token `--radius-*` semuanya di-override ke 0 di `@theme` — jadi `rounded-md` yang terlupa tetap tampil siku. Ini jaring pengaman, bukan izin untuk menulis `rounded-*`.
- Font display brutalism (`--font-display`, Space Grotesk) di-wire ke `next/font/google` di `app/layout.tsx` dengan pola yang sama seperti `--font-plus-jakarta`. **Jangan** isi `weight` — Space Grotesk variable font, dan array `weight` membuat Turbopack gagal resolve.
- `@layer base` di `globals.css` sudah membuat `h1`–`h4` otomatis uppercase + `font-display`, dan focus ring memakai `outline: 3px solid primary` dengan `offset 0` (bukan ring biru default browser yang membulat).
- `app/globals.css` memakai `source(none)` + daftar `@source` eksplisit. Jangan menambah `@source` untuk `docs/` atau file markdown — di situ ada daftar class yang dilarang, dan Tailwind akan mengirimkannya sebagai CSS sungguhan. Detail dan cara verifikasi ada di [Budget Performa](#budget-performa).
- `shadow-brutal*` adalah `@utility`, bukan token `--shadow-*` di `@theme`. Memindahkannya kembali akan menarik pipeline compositor Tailwind. Gunakan `press-brutal` untuk efek tekan, jangan `shadow-none`.
- Migration dari tema terracotta sudah selesai. Kalau menemukan sisa, grep `rounded-sm\|rounded-md\|shadow-card\|c7501f` di `app components lib`.
