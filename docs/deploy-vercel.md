# Deploy ke Vercel

Runbook teknis untuk mendeploy aplikasi ini ke Vercel. Untuk menyiapkan
database dan data awal, lihat [provisioning.md](provisioning.md) — dokumen ini
hanya dari sisi aplikasi.

> **Status dokumen:** disusun dari konfigurasi repo yang ada, tapi **belum pernah
> dijalankan end-to-end** sampai deployment pilot pertama. Yang belum terverifikasi
> ditandai 🔬. Perbarui begitu benar-benar dijalankan.

---

## Ringkasan

| Item | Nilai |
|---|---|
| Platform | Vercel (adapter terverifikasi untuk Next.js) |
| Framework preset | Next.js, terdeteksi otomatis |
| Build command | `npm run build` (default Vercel, jangan diubah) |
| Install command | `npm install` (default — **jangan** `--omit=dev`) |
| Node.js | Minimal **20.9** (persyaratan Next.js 16). Tambahkan `engines` ke `package.json` supaya tidak bergantung tebakan |
| Region | `sin1` (Singapore), agar sepadan dengan Supabase `ap-southeast-1` |
| `vercel.json` | **Tidak perlu.** Repo tidak punya, dan tidak perlu ditambahkan |
| Runtime | Node.js (ada 3 route handler dinamis + middleware, jadi tidak bisa static export) |

---

## Langkah 0 — Prasyarat

Centang semua dulu. Poin kedua **saat ini belum terpenuhi**.

- [ ] `npm run lint` keluar 0
- [ ] `npm run build` keluar 0
- [ ] Repo punya minimal satu commit
- [ ] Remote git (GitHub/GitLab) sudah berisi commit tersebut
- [ ] Tidak ada file rahasia yang ikut ter-commit
- [ ] Migration sudah ter-apply di project Supabase tujuan (lihat `provisioning.md` §1)

Cek commit dan remote:

```bash
git rev-list --count HEAD     # harus > 0
git remote -v                 # harus ada baris fetch/push
git status --porcelain        # harus kosong, atau sengaja belum di-commit
```

Cek file rahasia tidak akan ikut ter-push:

```bash
git check-ignore -v .env.local   # harus kena aturan .env*
git check-ignore -v .env.example # harus TIDAK ke-ignore (sengaja ikut commit)
```

`.gitignore` sudah menutup `.env*` dan kecuali `.env.example`, jadi selama
tidak pernah dipaksa `git add -f`, kredensial aman.

### Kalau commit pertama belum dibuat

```bash
git add -A
git status --porcelain        # periksa: tidak boleh ada .env.local
git commit -m "chore: initial commit"
```

> `tsconfig.tsbuildinfo` dan `next-env.d.ts` sudah di-ignore, jadi ikut aman
> kalau ter-add.

---

## Langkah 1 — Push ke GitHub

```bash
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```

Kalau repo ini nanti dipakai untuk banyak klien (1 klien = 1 project Vercel),
pertimbangkan ** privat** dan invites per orang — bukan public.

---

## Langkah 2 — Buat project di Vercel

1. Vercel dashboard → **Add New → Project** → import repo GitHub.
2. Biarkan preset terdeteksi otomatis:
   - Framework Preset: **Next.js**
   - Root Directory: `/` (biarkan)
   - Build Command: `npm run build`
   - Install Command: `npm install`
3. **Region: `sin1` (Singapore)** — di Project Settings → Functions. Harus
   sepadan dengan region Supabase, kalau tidak tiap query bolak-balik
   menyeberangi Samudra Hindia dan laporan terasa lambat.
4. Deploy.

> 🔬 Pada paket Hobby, opsi region bisa terbatas. Kalau `sin1` tidak muncul,
> catat faktanya di dokumen ini setelah deployment pertama — jangan diam-diam
> deploy di region lain dan jangan menyimpan masalah latency secara diam-diam.

---

## Langkah 3 — Environment variables

Di Project Settings → Environment Variables. Pilih **Production** (dan
**Preview** kalau mau preview yang bisa dipakai sebagai uji coba).

| Variable | Wajib? | Sensitif | Catatan |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Ya** | tidak | Dikirim ke browser. Lihat kotak peringatan di bawah |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Ya** | tidak | Dikirim ke browser. Aman secara desain (RLS yang melindungi) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Ya** | **Ya** | **Server only.** Jangan pernah diberi prefix `NEXT_PUBLIC_`, jangan pernah di-*commit* |
| `NEXT_PUBLIC_CLIENT_NAME` | **Ya** | tidak | Tampil di UI |
| `MIDTRANS_SERVER_KEY` | Kalau QRIS dipakai | **Ya** | Akun **klien**, bukan akun Anda |
| `MIDTRANS_ENV` | Kalau QRIS dipakai | tidak | `production` di produksi. Kosongkan untuk default production |
| `SUPABASE_DB_URL` | **Jangan diisi** | — | Hanya untuk menjalankan migration dari mesin developer |

`SUPABASE_DB_URL` sengaja tidak ada di tabel Vercel: itu connection string
database, aplikasi tidak memakainya saat runtime. Mengisinya di Vercel hanya
membuat kebocoran yang tidak perlu.

### ⚠️ `NEXT_PUBLIC_*` di-inline saat build

Variable berawalan `NEXT_PUBLIC_` **ditanam ke dalam bundle saat build**. Mengubah
nilainya di dashboard Vercel lalu redeploy **tidak** mengubah apa pun — perlu
build ulang (redeploy dari commit baru, atau trigger build ulang di dashboard).

Kalau протести tidak bisa menjelaskan perubahan nama bisnis yang tidak muncul
di layar, ini penyebab pertama.

### ⚠️ Build tetap hijau kalau env var penting lupa diisi

Sudah diuji: `NEXT_PUBLIC_SUPABASE_URL` dikosongkan, `npm run build` tetap
**sukses** tanpa warning. Yang akibatnya:

- `next.config.ts` menurunkan `remotePatterns` dari env itu. Kosong →
  `remotePatterns: []` → **semua gambar produk dari Supabase Storage gagal**
  dimuat (`next/image` menolak host yang tidak terdaftar), sementara build
  terlihat benar.
- Nama bisnis tampil kosong.

Jadi "build hijau" **bukan** bukti env var sudah benar. Verifikasi lewat smoke
test di Langkah 6, bukan lewat status build.

---

## Langkah 4 — Konfigurasi Supabase untuk domain produksi

Login sebagai owner dari domain Vercel, lalu di Supabase → **Authentication →
URL Configuration**:

- **Site URL**: `https://<domain-klien>`
- **Redirect URLs**: tambahkan `https://<domain-klien>/**` (dan domain preview
  kalau dipakai untuk uji coba)

Tanpa ini, login admin bisa gagal atau melompat ke `localhost` milik mesin
pengembang.

---

## Langkah 5 — Konfigurasi Midtrans

Kalau QRIS dipakai:

1. Di dashboard Midtrans akun **klien** → **Settings → Notification URLs** →
   isikan `https://<domain-klien>/api/midtrans/webhook`
2. Pastikan `MIDTRANS_SERVER_KEY` memakai key **production** (bukan sandbox)
3. Arahkan `MIDTRANS_ENV` ke `production`

Kalau `MIDTRANS_SERVER_KEY` kosong di production, kode **sengaja menolak**
menjalankan QRIS (mode mock hanya untuk dev/demo) — lihat `lib/payment/midtrans.ts`.
Itu pilihan yang benar untuk produksi, tapi berarti QRIS tidak bisa dipakai
sampai key diisi.

---

## Langkah 6 — Smoke test setelah deploy

Jalankan di **HP fisik** lewat browser (bukan curl). Sebagian besar jebakan
berikut hanya muncul di perangkat sungguhan.

- [ ] Buka `https://<domain-klien>` — halaman masuk tampil, **nama bisnis benar** (kalau kosong, `NEXT_PUBLIC_CLIENT_NAME` belum ter-build)
- [ ] Login owner berhasil dan mendarat di dashboard (kalau terlempar balik ke login terus-menerus, cookie sesi tidak tersimpan → periksa Site URL Supabase)
- [ ] Buka daftar produk admin → **gambar produk benar-benar tampil** (ini yang gagal diam-diam kalau `NEXT_PUBLIC_SUPABASE_URL` kosong saat build)
- [ ] Install PWA ke home screen (Chrome Android)
- [ ] Buka `/dev/ui` → token neo-brutalism tampil, heading uppercase Space Grotesk
- [ ] Buka DevTools → Application → Service Workers → `/sw.js` **terdaftar** (hanya di production; di dev sengaja tidak aktif)
- [ ] Buka DevTools → Network → filter `font` → hanya **2** file woff2 yang diunduh, keduanya subset latin
- [ ] Matikan jaringan → `/offline` masih terbuka
- [ ] Kasir: scan QR → transaksi tunai tersimpan lokal
- [ ] Nyalakan jaringan → antrian terkirim, badge berubah "tersimpan"
- [ ] QRIS (kalau dipakai) → bayar nominal kecil sungguhan, lalu refund

---

## Langkah 7 — Operasional

### Rollback

Vercel → Deployments → pilih deployment sebelumnya → **Promote to Production**.
Cukup begitu, tidak perlu redeploy dari git. Hanya berlaku untuk kode — kalau
masalahnya di environment variable, perbaiki variablenya lalu build ulang.

### Mengubah environment variable

| Jenis variable | Apa yang perlu dilakukan |
|---|---|
| Server-only (tanpa `NEXT_PUBLIC_`) | Redeploy — **tidak** perlu build ulang |
| `NEXT_PUBLIC_*` | **Build ulang**. Redeploy saja tidak mengubah bundle |

### Service worker

`public/sw.js` memakai strategi *network-first* untuk navigasi, jadi kasir
mendapat versi terbaru begitu online dan tidak terjebak shell basi. Yang
di-cache cuma halaman `/offline`.

Kalau perlu memaksa klien dapat versi baru (mis. ada perubahan yang merusak),
Naikkan `CACHE` di `public/sw.js` (mis. `v1` → `v2`). Handler `activate` akan
menghapus cache lama. Menaikkan versi tanpa mengubah kode lain adalah cara
paling aman untuk Viagra.

### Log

Sampai Sentry terpasang (task M9-3), andalkan log deployment Vercel per
instance. Buka Deployment → **Function Logs**.

---

## Jebakan yang sudah teridentifikasi

| Gejala | Penyebab | Solusi |
|---|---|---|
| Build hijau, semua gambar produk rusak | `NEXT_PUBLIC_SUPABASE_URL` kosong saat build → `remotePatterns: []` | Isi env var, lalu **build ulang** |
| Nama bisnis tidak berubah | `NEXT_PUBLIC_CLIENT_NAME` di-inline saat build | Build ulang, redeploy saja tidak cukup |
| Login admin terlempar balik ke login terus-menerus | Site URL / Redirect URL Supabase masih `localhost` | Setel `Authentication → URL Configuration` |
| QRIS ditolak dengan pesan "MIDTRANS_SERVER_KEY kosong di production" | Key belum diisi | Isi `MIDTRANS_SERVER_KEY` production milik klien |
| `middleware` warning di log build | Next.js 16 mengganti nama konvensi `middleware.ts` → `proxy.ts` | Hanya warning, tidak mengubah apa pun. Rename `middleware.ts` menjadi `proxy.ts` (fungsinya identik) kapan saja.]
| Opsi region `sin1` tidak tersedia | Paket Hobby membatasi region | Catat faktanya; kalau tidak bisa pindah paket, ukur dulu latensi nyata |
| Install command Containment `npm ci --omit=dev` | `sharp` ada di `devDependencies` dan dibutuhkan image optimization | Kembalikan ke `npm install` |

---

## 🔬 Yang perlu dikonfirmasi saat deployment pertama

- [ ] Berapa lama build pertama dari push sampai hijau
- [ ] Apakah `sin1` bisa dipilih di paket yang dipakai
- [ ] Latensi nyata query Supabase dari region deployment (untuk laporan dashboard)
- [ ] Apakah `proxy.ts` rename perlu dilakukan sekarang atau bisa ditunda
- [ ] Berapa MB bundle yang terunduh saat pertama kali buka `/pos/kasir` di HP jaringan seluler

Catat angka asli di sini setelah pertama kali jalan — provisioning.md juga
meminta pencatatan waktu, dan angka asumsi lebih sering menyesatkan daripada
"Tidak tahu".
