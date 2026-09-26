# 01 — Fondasi Proyek

## Apa Ini

Kerangka aplikasi sebelum ada fitur bisnis apa pun: Next.js jalan, warna dan font sudah sesuai panduan desain, komponen dasar tersedia, dan aplikasi bisa di-*install* ke layar utama HP seperti aplikasi biasa.

Target akhirnya satu: begitu kamu mulai membangun halaman kasir, kamu tidak perlu lagi memikirkan warna tombol, ukuran font, atau bagaimana caranya agar tombol enak dipencet di HP. Semua itu sudah diputuskan.

## Stack

| Bagian | Pilihan | Versi |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.3 |
| UI | React | 19.2 |
| Bahasa | TypeScript | 5 |
| Styling | Tailwind CSS | v4 |
| Ikon | lucide-react | 1.x |
| Database | Supabase (PostgreSQL) | PG 17.6 |

> **App Router** adalah cara Next.js modern menentukan rute: folder di dalam `app/` otomatis jadi URL. `app/admin/kedai/page.tsx` → `/admin/kedai`. Tidak ada file konfigurasi rute.

## Cara Mulai

```bash
npm install
cp .env.example .env.local   # lalu isi kredensial Supabase
npm run dev                  # buka http://localhost:3000
```

Kalau `.env.local` belum diisi, halaman yang menyentuh database akan melempar error dengan pesan yang menyebut **nama variabel** yang kosong — itu disengaja, lihat `lib/supabase/env.ts`.

## Struktur Folder

```
app/            Halaman & rute (App Router)
  admin/        Dashboard owner — layar lebar, sidebar
  pos/          Kasir di HP — mobile-first, bottom nav
  dev/ui/       Halaman preview komponen
components/
  ui/           Komponen dasar: Button, Input, Card, Badge, Modal, Table
  admin/        Shell admin (sidebar + drawer + form login)
  pos/          Komponen khusus kasir
  pwa/          Registrasi service worker
lib/
  supabase/     Client database
  utils.ts      cn(), formatRupiah()
  auth.ts       Helper otorisasi admin
supabase/
  migrations/   File SQL perubahan skema
  tests/        Uji constraint & RLS
scripts/        Perkakas: seed, generate tipe, generate ikon
docs/           Dokumen rancangan
docs/panduan/   Dokumen ini
```

## Design Token

**Aturan paling penting di proyek ini: jangan pernah menulis kode warna langsung di komponen.**

Salah:
```tsx
<button className="bg-[#FFD400]">Simpan</button>
```

Benar:
```tsx
<button className="bg-primary text-ink border-2 border-ink shadow-brutal">Simpan</button>
```

Kenapa: sistem ini dijual ke banyak klien. Kalau suatu saat satu klien minta warna brand berbeda, kita cukup mengubah **satu file** (`app/globals.css`) — bukan mencari-cari hex code di seratus komponen.

Semua token didefinisikan di blok `@theme` dalam `app/globals.css`, dan sumber kebenarannya `docs/design_1.md`. Kalau butuh warna baru: tambahkan ke `design_1.md` dulu, baru ke `globals.css`.

### Token yang tersedia

| Kategori | Class |
|---|---|
| Brand | `bg-primary`, `bg-primary-dark`, `bg-primary-light` |
| Aksen | `bg-accent-blue`, `bg-accent-blue-light` |
| Netral | `bg-background`, `bg-surface`, `bg-surface-alt` |
| Garis & teks | `border-ink`, `text-ink`, `text-text-secondary`, `text-text-disabled` |
| Status (isi) | `bg-success`, `bg-warning`, `bg-danger`, `bg-info` |
| Status (teks di atas putih) | `text-success-text`, `text-warning-text`, `text-danger-text`, `text-info-text` |
| Radius | **0 di semua elemen**; `rounded-sm` (2px) hanya untuk badge/chip |
| Shadow | `shadow-brutal-sm` (2px), `shadow-brutal` (4px), `shadow-brutal-lg` (6px) — semua offset keras tanpa blur |
| Efek tekan | `press-brutal` (utility): translate 2px + shadow hilang saat `:active` |

### Tiga aturan neo-brutalism yang tidak boleh dilanggar

1. **Radius 0.** Kalau butuh kotak membulat, itu bukan brutalism — dan `design_1.md` juga melarangnya.
2. **Shadow tanpa blur.** `shadow-brutal*` satu-satunya yang boleh. Tidak ada `shadow-lg`, `drop-shadow`, atau `blur-*`.
3. **Warna solid, tanpa transparansi di brand.** Tidak ada gradient. Warna semantik untuk status, bukan dekorasi.

### Dua aturan tambahan yang menentukan ukuran CSS

Dua ini kelihatan seperti detail teknis, tapi menentukan berapa CSS yang terkirim ke user. Keduanya punya penjelasan lengkap di [design_1.md → Budget Performa](../design_1.md#budget-performa).

1. **Tailwind hanya boleh memindai direktori kode.** `app/globals.css` pakai `source(none)` lalu daftar `@source` eksplisit (`app`, `components`, `lib`, `scripts`, `public`). Tanpa itu Tailwind ikut memindai `docs/*.md` dan `AGENTS.md` — yang isinya justru daftar class **terlarang**, dan itu terkirim jadi CSS sungguhan. Kalau bikin folder baru yang mungkin berisi `className`, daftarkan di `@source`.
2. **Jangan pakai `shadow-none`.** State ditekan dan nonaktif sudah ditangani `press-brutal` (`:active` dan `:disabled`). `shadow-none` milik namespace bawaan Tailwind yang menarik pipeline compositor berisi puluhan properti — nol gunanya di brutalism.

Hasilnya: CSS global **26,9 KB** (6,4 KB gzip), font **48,4 KB** untuk dua family subset latin.

### Jebakan: `text-primary` bukan warna teks

Ini paling sering bikin bingung.

```tsx
<p className="text-primary">  {/* teks KUNING (warna brand) — kontras buruk di atas putih */}
<p className="text-ink">      {/* teks hitam (warna teks utama) */}
```

Di Tailwind, `text-<warna>` selalu berarti "warna teks". Karena token brand kita bernama `primary`, class `text-primary` otomatis berarti kuning. Warna teks utama dinamai `ink`, jadi class-nya `text-ink` — dan **tidak** ada lagi tabrakan `text-text-primary` seperti di versi desain sebelumnya.

Jebakan serupa: warna status **solid** (`#3ddc84`, `#ffd400`) tidak boleh dipakai sebagai warna teks di atas putih — kontrasnya di bawah 2:1. Untuk teks di atas permukaan putih, pakai varian gelap: `text-success-text`, `text-danger-text`, dst.

### Spacing

Hanya nilai ini yang boleh dipakai: **4, 8, 12, 16, 24, 32, 48, 64 px**.

Di Tailwind: `1, 2, 3, 4, 6, 8, 12, 16`. Jangan pakai `p-5`, `gap-7`, `m-9`.

Kenapa dibatasi: tanpa batasan, tiap orang memilih angka sendiri dan hasilnya UI terasa tidak rapi meski sulit ditunjuk salahnya di mana.

## Komponen UI

Semua ada di `components/ui/`. Lihat semuanya sekaligus di **`/dev/ui`** — jalankan `npm run dev` lalu buka `http://localhost:3000/dev/ui`.

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

<Button variant="primary" size="md">Simpan</Button>
<Button variant="danger">Void transaksi</Button>

<Input label="Kas awal" numeric hint="Dihitung sebelum toko buka" />
<Input label="Jumlah" error="Melebihi stok kedai asal" />

<Badge tone="success">Tersimpan</Badge>
<Badge tone="warning">Belum sync</Badge>
```

Catatan penting per komponen:

- **Button** ukuran `md` = 44px. Itu tinggi minimum agar nyaman dipencet jari. Ukuran `sm` (36px) **hanya boleh di dashboard admin**, jangan di halaman kasir. Font `uppercase` + `bold`, dan teksnya hitam di atas kuning.
- **Input** mewajibkan prop `label`. Sengaja: `placeholder` bukan pengganti label — teksnya hilang begitu user mulai mengetik, dan orang jadi lupa kolom itu untuk apa.
- **Badge** memakai **isi warna solid** + border `2px ink`, bukan latar transparan. Warna solid + garis hitam jauh lebih terbaca di layar HP di bawah cahaya terang.
- **Modal** memakai elemen `<dialog>` bawaan browser, jadi tombol Esc, kunci scroll latar, dan *focus trap* sudah ditangani browser. Di HP tampil sebagai bottom sheet, di desktop sebagai modal tengah. Header-nya blok kuning solid agar jelas di mana area modal berakhir.

### Helper

```ts
import { cn, formatRupiah } from "@/lib/utils";

cn("px-4", kondisi && "bg-primary")  // gabung class, yang belakangan menang
formatRupiah(22000)                  // "Rp 22.000"
```

## PWA

PWA (*Progressive Web App*) = aplikasi web yang bisa di-*install* ke layar utama HP dan terasa seperti aplikasi asli, tanpa harus lewat Play Store.

Yang sudah ada:

| File | Fungsi |
|---|---|
| `app/manifest.ts` | Nama app, warna, ikon. Otomatis disajikan di `/manifest.webmanifest` |
| `app/icon.svg` | Ikon sumber + favicon |
| `public/icons/*` | Ikon PNG hasil generate (192, 512, maskable) |
| `public/sw.js` | Service worker |
| `app/offline/page.tsx` | Halaman yang muncul saat navigasi gagal karena offline |

Regenerate ikon setelah mengubah `app/icon.svg`:

```bash
npm run icons
```

### Peringatan: jangan isi `metadata.icons`

Di `app/layout.tsx`, **jangan** menambahkan field `icons` ke `metadata`. Begitu diisi manual, Next mengabaikan konvensi file dan favicon dari `app/icon.svg` **hilang tanpa pesan error apa pun**. Ini pernah terjadi dan hanya ketahuan saat memeriksa `<head>` secara manual.

### Service worker sengaja tidak menyimpan data

`public/sw.js` hanya menyimpan satu halaman offline. Ia **tidak** menyimpan respons API/Supabase.

Alasannya penting: di aplikasi kasir, data stok basi yang menyamar sebagai data valid lebih berbahaya daripada error jaringan yang terlihat jelas. Kalau kasir melihat "stok 40" padahal sebenarnya 0, dia menjual barang yang tidak ada.

Antrian transaksi offline **bukan** tugas service worker — itu memakai IndexedDB dan dikerjakan di fase M2.

## Cara Memverifikasi

```bash
npm run build   # harus "Compiled successfully"
npm run lint    # tidak ada output = bersih
npx tsc --noEmit  # tidak ada output = tipe aman
```

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| Class Tailwind tidak berefek | Token belum ada di `@theme` | Tambahkan ke `app/globals.css`, restart `npm run dev` |
| Teks jadi kuning padahal mau hitam | Pakai `text-primary` | Ganti jadi `text-ink` |
| Teks status tidak terbaca di atas putih | Pakai `text-danger` (warna solid) | Ganti jadi `text-danger-text` (atau `text-success-text` / `text-warning-text` / `text-info-text`) |
| Kotak terlihat membulat | Token `--radius-*` belum di-override ke 0 | Semua radius sudah 0 di `globals.css`; `rounded-sm` (2px) hanya untuk badge |
| Build gagal: `Can't resolve '@vercel/turbopack-next/internal/font/google/font'` | `next/font` diberi array `weight` | Hapus `weight` — pakai variable font tanpa `weight` |
| Favicon hilang | `metadata.icons` diisi manual | Hapus field `icons` dari `app/layout.tsx` |
| `tsc` mengeluh soal `.next/types/validator.ts` | Cache tipe basi setelah file dipindah | Jalankan `npm run build` dulu, lalu `tsc` lagi |
| Perubahan kode tidak muncul di browser | Service worker menyimpan versi lama | SW hanya aktif di production build; di dev seharusnya tidak terjadi. Kalau tetap: DevTools → Application → Service Workers → Unregister |
| Class di folder baru tidak berefek, tapi build hijau | Folder itu belum terdaftar di `@source` (`source(none)` mematikan deteksi otomatis) | Tambahkan `@source "../nama-folder"` di `app/globals.css` |
| CSS production tiba-tiba jauh lebih besar | Ada class karangan di markdown (`docs/`, `AGENTS.md`) ikut dipindai | Pastikan `source(none)` + daftar `@source` masih utuh di `globals.css` |
| Heading kesimakan font fallback lalu melompat | Preload font hilang | Pastikan `preload: true` di kedua font `next/font` di `app/layout.tsx`. Catatan: di Next.js 16 preload appear sebagai hint `HL[..., "font", ...]` di flight payload, bukan tag `<link>` di HTML |

## Istilah

- **App Router** — sistem rute Next.js berbasis struktur folder di `app/`.
- **Design token** — nilai desain (warna, spacing, radius) yang diberi nama dan dipakai bersama, bukan ditulis ulang tiap tempat.
- **PWA** — web app yang bisa di-install ke HP.
- **Service worker** — skrip yang berjalan di latar browser dan bisa mencegat request jaringan.
- **Tap target** — area yang bisa dipencet jari. Minimum 44×44px agar tidak salah pencet.
