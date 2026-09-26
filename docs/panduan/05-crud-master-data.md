# 05 — CRUD Master Data (Kedai & Produk)

Mencakup task **M1-3** (kedai) dan **M1-4** (produk).

## Apa Ini

Dua halaman admin untuk mengelola data yang jadi fondasi seluruh sistem:

| Halaman | Isi | Dipakai oleh |
|---|---|---|
| `/admin/kedai` | Daftar cabang | Semua modul — transaksi, stok, shift, laporan discope per kedai |
| `/admin/produk` | Katalog menu | Halaman kasir, stok per kedai |

Keduanya memakai pola yang sama, jadi kalau kamu paham satu, kamu paham keduanya. Halaman CRUD berikutnya (karyawan, pengeluaran) sebaiknya mengikuti pola ini juga.

## Prinsip: Tidak Ada Tombol Hapus

Kedai dan produk **tidak bisa dihapus**, hanya dinonaktifkan (`is_active = false`).

Alasannya bukan kehati-hatian berlebihan. Transaksi, shift, stok, dan pengeluaran yang sudah terjadi tetap merujuk ke baris itu. Menghapusnya memutus riwayat — laporan omzet bulan lalu jadi tidak bisa direkonstruksi.

Ini juga ditegakkan database: foreign key-nya memakai `on delete restrict`, jadi `DELETE` akan ditolak Postgres bahkan kalau seseorang mencoba lewat SQL langsung.

Efek menonaktifkan:
- Produk nonaktif hilang dari layar kasir, riwayat penjualannya tetap utuh
- Kedai nonaktif tidak bisa dipakai membuka shift baru

## Pola Empat File

Setiap halaman CRUD terdiri dari empat file dengan tanggung jawab terpisah:

```
app/admin/(dashboard)/<fitur>/
  page.tsx      Server Component — ambil data, tidak ada interaksi
  actions.ts    Server Action   — validasi + tulis ke database
components/admin/
  <fitur>-list.tsx   Client — tabel, state modal, tombol
  <fitur>-form.tsx   Client — form di dalam modal
```

### `page.tsx` — ambil data

```tsx
export default async function KedaiPage() {
  const supabase = await createClient();      // perhatikan await
  const { data, error } = await supabase
    .from("kedai")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  if (error) { /* tampilkan pesan, jangan lempar */ }
  return <KedaiList data={data ?? []} />;
}
```

Memakai `lib/supabase/server.ts` — anon key + sesi user, jadi **tetap lewat RLS**. Kalau suatu saat query ini mengembalikan kosong padahal data ada di database, penyebabnya hampir pasti otorisasi, bukan query-nya.

Urutannya sengaja: yang aktif di atas. Admin jauh lebih sering menyentuh yang sedang dipakai daripada yang sudah dipensiunkan.

### `actions.ts` — validasi lalu tulis

```ts
"use server";

const kedaiSchema = z.object({
  name: z.string().trim().min(1, "Nama kedai wajib diisi").max(100, "..."),
  low_stock_threshold: z.coerce.number().int().min(0).max(9999),
  // ...
});

export async function createKedai(_prev: FormState, formData: FormData) {
  await requireAdmin();                       // 1. otorisasi
  const parsed = parse(formData);             // 2. validasi
  if (!parsed.success) return { error: "...", fieldErrors: ... };

  const supabase = await createClient();      // 3. tulis
  const { error } = await supabase.from("kedai").insert(parsed.data);
  if (error) return { error: `Gagal menyimpan kedai: ${error.message}` };

  revalidatePath("/admin/kedai");             // 4. segarkan cache
  return { error: null, ok: true };
}
```

Empat hal yang wajib ada di setiap server action, urut:

1. **`requireAdmin()`** — server action punya endpoint sendiri dan bisa dipanggil langsung tanpa lewat UI. Fakta bahwa form-nya hanya dirender di halaman terproteksi **bukan** pengaman.
2. **Validasi Zod** — atribut `required` di HTML cuma membantu user, bukan penjaga.
3. **Tulis** lewat client server (kena RLS).
4. **`revalidatePath()`** — tanpa ini, halaman menampilkan data lama setelah simpan dan user mengira tombolnya tidak berfungsi.

### `<fitur>-form.tsx` — form di modal

```tsx
const action = kedai ? updateKedai.bind(null, kedai.id) : createKedai;
const [state, formAction] = useActionState(action, initialState);

useEffect(() => { if (state.ok) onClose(); }, [state.ok, onClose]);
```

`bind` dipakai untuk menyisipkan `id` sebagai argumen pertama, sehingga satu komponen form melayani mode tambah dan ubah sekaligus.

Penanda `ok` diperlukan karena `initialState` juga punya `error: null` — tanpa penanda terpisah, modal akan menutup sendiri saat pertama dibuka.

### `<fitur>-list.tsx` — tabel dan state

```tsx
<KedaiForm
  key={editing?.id ?? "baru"}   // <- penting
  open={formOpen}
  kedai={editing}
/>
```

Prop `key` memaksa React membuat ulang komponen form saat target berganti. Tanpa itu, `defaultValue` tidak ikut berubah dan isian kedai sebelumnya tertinggal di form — bug yang halus dan mudah lolos saat pengujian manual.

Toggle aktif memakai `useTransition` supaya tombol bisa dinonaktifkan selama proses berjalan:

```tsx
const [pending, startTransition] = useTransition();
startTransition(async () => { await setKedaiActive(kedai.id, !kedai.is_active); });
```

## Unggah Gambar Produk

Ini bagian yang paling berbeda dari CRUD biasa.

### Gambar TIDAK lewat server action

```
Browser ──(file)──> Supabase Storage
   │
   └──(URL saja)──> Server Action ──> tabel products
```

Tiga alasan:

1. **Server action Next dibatasi 1MB** per request secara bawaan. Foto dari kamera HP gampang menembusnya.
2. Menaikkan batas itu berarti seluruh byte gambar melewati server Next lebih dulu — lambat, dan di Vercel dibayar per waktu eksekusi.
3. Tujuannya cuma menaruh file di Storage. Server Next tidak perlu ikut memegangnya.

### Bucket dibuat lewat migration

`supabase/migrations/0003_storage_produk.sql` — bukan diklik di dashboard, supaya instance klien baru mendapat hasil sama hanya dengan menjalankan migration.

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('produk', 'produk', true, 2097152, array['image/jpeg','image/png','image/webp']);
```

Batas 2MB dan daftar tipe file ditegakkan **Storage**, bukan form. Kode browser bisa dilewati; bucket tidak. Sudah diuji: mengunggah `text/plain` sebagai admin tetap ditolak `400`.

### Policy Storage

| Aksi | Siapa | Kenapa |
|---|---|---|
| Baca | Siapa saja | Gambar tampil di layar kasir, dan kasir tidak punya sesi Supabase Auth |
| Unggah / ubah / hapus | Admin aktif | Memakai `is_active_admin()` yang sama dengan RLS tabel |

Karena memakai fungsi yang sama, menonaktifkan seorang admin langsung mencabut hak unggahnya juga — tidak perlu langkah terpisah.

### `next.config.ts`

`next/image` menolak URL dari host yang tidak terdaftar:

```ts
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;
```

Diturunkan dari env, **bukan ditulis mati** — hostname berbeda di tiap instance klien. Kalau ditulis mati, gambar produk klien kedua tidak akan tampil dan pesan errornya tidak menunjuk ke penyebabnya.

### Membersihkan gambar lama

Gambar yang diganti dihapus supaya tidak menumpuk file yatim yang tetap memakan kuota. Ada dua titik pembersihan, dan keduanya perlu:

| Kapan | Di mana | Yang dihapus |
|---|---|---|
| User ganti pilihan sebelum menekan Simpan | Browser (`storage-client.ts`) | Unggahan perantara |
| Setelah update berhasil | Server action | Gambar asli produk |

Urutannya penting: gambar lama dihapus **setelah** update berhasil. Kalau dihapus lebih dulu lalu update-nya gagal, produk kehilangan gambar tanpa ada yang menggantikan.

Kegagalan menghapus sengaja tidak digagalkan ke user — file yatim hanya memakan kuota, sementara perubahan produknya sendiri sudah tersimpan benar.

### Kenapa `lib/storage.ts` dan `lib/storage-client.ts` dipisah

`lib/storage.ts` tidak mengimpor client Supabase apa pun, jadi aman dipakai server action. `lib/storage-client.ts` memakai client browser. Kalau digabung, server action akan ikut menarik kode browser.

## Cara Menguji

```bash
npm run build && npm run lint && npx tsc --noEmit
npm run dev
```

Lalu masuk `/admin/login` dengan `owner@kedaidev.test` / `dev-owner-2026`, dan periksa:

**Kedai** — tambah kedai baru · ubah nama · nonaktifkan lalu aktifkan lagi · coba simpan dengan nama kosong (harus muncul pesan di bawah kolomnya)

**Produk** — tambah produk dengan gambar · ganti gambarnya, pastikan yang lama hilang dari bucket · coba unggah file > 2MB (harus ditolak) · nonaktifkan produk

Cek isi bucket:

```bash
npm run db -- -e "select name, created_at from storage.objects where bucket_id='produk' order by created_at desc limit 10"
```

## Kalau Error

| Gejala | Penyebab | Solusi |
|---|---|---|
| `TypeError: n is not iterable` | Konstanta diekspor dari file `"use server"` | Pindahkan konstanta ke file biasa (mis. `lib/timezones.ts`) |
| Form menampilkan data lama saat ubah | Prop `key` hilang di komponen form | Tambahkan `key={editing?.id ?? "baru"}` |
| Simpan berhasil tapi tabel tidak berubah | `revalidatePath()` lupa dipanggil | Tambahkan di akhir server action |
| Gambar tidak tampil, error hostname | Host Supabase belum di `remotePatterns` | Cek `next.config.ts`, restart dev server |
| Unggah gambar gagal `400` | Bukan admin aktif, atau tipe/ukuran file ditolak bucket | Cek sesi login; cek tipe file JPG/PNG/WebP < 2MB |
| Modal tidak menutup setelah simpan | Server action tidak mengembalikan `ok: true` | Tambahkan penanda `ok` |
| Halaman kosong padahal data ada | RLS — lihat panduan 03 | Pastikan user ada di `admin_users` dan `is_active` |

## Istilah

- **Server Action** — fungsi server yang bisa dipanggil langsung dari form browser. Ditandai `"use server"`.
- **`revalidatePath`** — memberi tahu Next bahwa cache halaman itu sudah basi dan harus diambil ulang.
- **`useActionState`** — hook React yang menyambungkan form ke server action dan menyimpan nilai kembaliannya.
- **`bind`** — menyisipkan argumen tetap ke sebuah fungsi; di sini dipakai mengirim `id` ke server action.
- **Bucket** — wadah penyimpanan file di Supabase Storage.
- **File yatim** — file yang masih ada di Storage tapi tidak lagi dirujuk baris mana pun.
