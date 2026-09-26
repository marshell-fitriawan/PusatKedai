# 03 — Auth & Keamanan

## Apa Ini

Cara sistem menentukan **siapa kamu** dan **boleh apa saja**. Mencakup login admin, proteksi rute, Row Level Security, dan tiga varian client Supabase yang tidak boleh tertukar.

Baca ini sampai selesai sebelum menulis kode yang menyentuh database. Salah pilih client di sini berarti data satu kedai bocor ke kedai lain, dan tidak ada error apa pun yang memberi tahu kamu.

## Dua Jenis Pengguna, Hanya Satu Lewat Supabase Auth

| | Admin / Owner | Kasir / Karyawan |
|---|---|---|
| Cara login | Email + password | Scan QR pribadi |
| Punya akun Supabase Auth? | **Ya** | **Tidak** |
| Punya `auth.uid()`? | Ya | Tidak |
| Dilindungi RLS? | Ya | **Tidak bisa** |
| Rute | `/admin/*` | `/pos/*` |

Baris "Tidak bisa" itu konsekuensi yang wajib dipahami: karena karyawan bukan user Supabase Auth, mereka tidak punya identitas yang bisa dibaca RLS. **RLS tidak akan pernah bisa membatasi karyawan per kedai.**

Pembatasan itu tanggung jawab lapisan server — dijelaskan di bagian "Tiga Client" di bawah.

Kenapa dirancang begitu: kasir berganti shift beberapa kali sehari. Mengetik email dan password setiap pergantian terlalu lambat untuk alur kerja kasir; scan QR memakan waktu dua detik.

## Alur Login Admin

```
User buka /admin/dashboard
        │
        ▼
  middleware.ts  ──── belum ada sesi? ──► redirect /admin/login?next=/admin/dashboard
        │
        │ ada sesi
        ▼
app/admin/(dashboard)/layout.tsx
  requireAdmin()  ──── tidak ada di admin_users? ──► redirect /admin/login?error=forbidden
        │
        │ admin aktif
        ▼
   Halaman dirender
```

### Kenapa dua lapis, bukan satu

**Middleware** hanya memeriksa *"ada sesi?"*. Ia berjalan di **setiap** request, jadi query database di sana akan memperlambat semuanya.

**Layout** memeriksa *"berhak?"* dengan query ke `admin_users`. Karena diletakkan di layout — bukan di tiap halaman — semua halaman di bawah `/admin` otomatis terlindungi. Kalau pemeriksaan dipasang per halaman, cepat atau lambat ada yang lupa dipasang saat menambah halaman baru.

> **Punya sesi ≠ berhak.** Supabase mengizinkan pendaftaran user. Orang yang berhasil mendaftar punya sesi yang sah, tapi kalau namanya tidak ada di `admin_users` dia tidak berhak apa-apa. Ini sudah diuji.

### File terkait

| File | Tugas |
|---|---|
| `middleware.ts` | Segarkan sesi + tahan yang belum login |
| `lib/auth.ts` | `getAdminUser()` dan `requireAdmin()` |
| `app/admin/actions.ts` | Server action `login()` dan `logout()` |
| `app/admin/login/page.tsx` | Halaman login |
| `components/admin/login-form.tsx` | Form (client component) |
| `app/admin/(dashboard)/layout.tsx` | Gerbang otorisasi |

### Detail yang gampang salah

**1. Redirect di middleware harus membawa cookie.**

Middleware menyegarkan token sesi. Kalau lalu melakukan `NextResponse.redirect()` biasa, cookie hasil penyegaran itu terbuang dan user terjebak loop login tanpa penjelasan. Ditangani `redirectPreservingCookies()`.

**2. Pakai `getUser()`, bukan `getSession()`.**

```ts
const { data: { user } } = await supabase.auth.getUser();  // ✅ divalidasi ke server
const { data: { session } } = await supabase.auth.getSession();  // ❌ dari cookie, bisa dipalsukan
```

Jangan pernah mengambil keputusan otorisasi dari `getSession()`.

**3. Halaman login tidak boleh mewarisi layout admin.**

Halaman terproteksi ada di `app/admin/(dashboard)/`. Tanda kurung membuatnya jadi *route group* — mengelompokkan file **tanpa mengubah URL**. Jadi `app/admin/(dashboard)/kedai/page.tsx` tetap `/admin/kedai`.

Kalau `app/admin/login` ikut di bawah layout itu, orang yang belum login akan melihat sidebar admin lengkap dengan seluruh menu.

**4. Login gagal harus mencabut sesi.**

Kalau kredensial benar tapi user tidak terdaftar sebagai admin, `login()` memanggil `signOut()` dan menampilkan pesan. Tanpa itu, user "berhasil login" lalu melihat dashboard kosong dan mengira sistemnya rusak.

**5. Pesan error login sengaja seragam.**

"Email atau password salah" — tidak dibedakan mana yang salah. Membedakannya membocorkan email mana yang punya akun di sistem klien.

**6. `?next=` divalidasi.**

Hanya path internal diterima. Tanpa itu, `?next=//situs-lain.com` menjadikan halaman login alat *open redirect* untuk phishing.

## Row Level Security (RLS)

**RLS** = aturan di level database yang menentukan baris mana yang boleh dilihat/diubah oleh siapa. Ditegakkan PostgreSQL sendiri, bukan oleh kode aplikasi — jadi tidak bisa dilewati dengan mengakali query.

### Aturannya di sini sederhana

- Admin aktif → akses penuh ke semua tabel
- **Selain itu → nol baris**

Tidak ada policy untuk anon. Tanpa policy = ditolak.

### Kenapa RLS penting padahal POS tidak memakainya

`NEXT_PUBLIC_SUPABASE_ANON_KEY` dikirim ke browser. **Kunci itu pasti bocor** — siapa pun bisa membukanya dari DevTools. Tanpa RLS, siapa pun yang menyalin kunci itu bisa membaca dan menulis seluruh data bisnis klien dari terminal mereka sendiri.

RLS di sini adalah pertahanan terhadap kebocoran itu. Bukan penegak akses untuk POS.

### Fungsi `is_active_admin()`

```sql
create or replace function public.is_active_admin()
returns boolean
language sql stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users
    where id = (select auth.uid()) and is_active
  );
$$;
```

Dua kata kunci yang tidak boleh dihapus:

- **`security definer`** — fungsi berjalan sebagai pemiliknya, sehingga query di dalamnya tidak ikut kena RLS. Tanpa ini, policy pada `admin_users` akan memanggil query ke `admin_users` lagi → rekursi tak berujung.
- **`set search_path`** — mengunci schema yang dicari. Fungsi `security definer` tanpa ini bisa dibajak lewat objek bernama sama di schema lain.

### Menguji RLS

```bash
npm run db -- supabase/tests/rls.sql
```

| Sebagai | Baris terbaca |
|---|---|
| anon (belum login) | 0 |
| **login tapi bukan admin** | **0** |
| admin aktif | 2 |
| admin dinonaktifkan | 0 |

Baris kedua yang paling penting. Kalau policy hanya memeriksa "sudah login", siapa pun yang berhasil mendaftar langsung punya akses penuh.

Baris keempat berarti menonaktifkan admin langsung memutus aksesnya — tidak perlu menunggu tokennya kedaluwarsa.

## Tiga Client Supabase — Jangan Tertukar

| File | Kunci | Kena RLS? | Dipakai di |
|---|---|---|---|
| `lib/supabase/client.ts` | anon | Ya | Komponen browser |
| `lib/supabase/server.ts` | anon | Ya | Server Component, Server Action |
| `lib/supabase/admin.ts` | **service role** | **TIDAK** | Server saja, kasus khusus |

```ts
// Browser
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();

// Server (perhatikan await -- ini async)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Service role
import { createAdminClient } from "@/lib/supabase/admin";
const db = createAdminClient();
```

### Aturan wajib untuk `admin.ts`

Service role **melewati seluruh RLS**. Ia dipakai hanya untuk hal yang memang harus lintas kedai atau tanpa identitas user:

- Endpoint sync transaksi offline (M2-4)
- Eksekusi perpindahan stok setelah approval (M4-5)
- Rekonsiliasi shift tertunda (M3-9)
- Sesi karyawan lewat QR (M3-4) — karena mereka bukan user Auth

**Setiap query lewat `admin.ts` wajib memfilter `kedai_id` secara eksplisit.**

```ts
// ❌ BAHAYA: mengembalikan transaksi SEMUA kedai
await db.from("transactions").select("*");

// ✅ BENAR
await db.from("transactions").select("*").eq("kedai_id", kedaiId);
```

Tidak ada yang akan memperingatkan kamu kalau filter itu lupa ditulis. Query pertama tetap berhasil, tetap mengembalikan data, dan kasir kedai A akan melihat transaksi kedai B.

### Pengaman `server-only`

`admin.ts` dan `auth.ts` mengimpor paket `server-only` di baris pertama. Efeknya: **build gagal** kalau file itu sampai terbawa ke bundle browser.

Lebih baik build gagal daripada service role key terkirim ke setiap pengunjung.

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| Loop redirect terus di `/admin/login` | Cookie sesi terbuang saat redirect | Pastikan `redirectPreservingCookies()` dipakai |
| Query balik `[]` padahal data ada | RLS memblokir | Cek pakai client mana; kalau server action, pastikan user sudah login |
| `infinite recursion detected in policy` | `is_active_admin()` kehilangan `security definer` | Jalankan ulang `0002_rls.sql` |
| Login berhasil tapi langsung balik ke login | User tidak ada di `admin_users` atau `is_active = false` | `npm run db -- -e "select email, is_active from admin_users"` |
| Build gagal: "server-only cannot be imported from a Client Component" | `admin.ts`/`auth.ts` dipakai di komponen `"use client"` | Pindahkan logikanya ke server action |
| Data kedai lain ikut muncul | Lupa `.eq("kedai_id", ...)` saat pakai `admin.ts` | Tambahkan filternya |

## Istilah

- **RLS (Row Level Security)** — aturan di database yang menyaring baris per pengguna.
- **Policy** — satu aturan RLS pada satu tabel.
- **anon key** — kunci publik, dikirim ke browser, aman karena dibatasi RLS.
- **service role key** — kunci rahasia, melewati semua RLS. Server saja, selamanya.
- **Middleware** — kode yang jalan sebelum halaman dirender, di setiap request.
- **Server Action** — fungsi yang ditulis di server tapi bisa dipanggil dari form di browser. Ditandai `"use server"`.
- **Route group** — folder berkurung `(nama)` yang mengelompokkan file tanpa mengubah URL.
- **Open redirect** — celah di mana parameter URL bisa mengarahkan user ke situs lain, dipakai untuk phishing.
