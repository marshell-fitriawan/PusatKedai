/**
 * Seed database pengembangan.
 *
 * Dua langkah, karena admin_users.id harus sama dengan id user Supabase Auth:
 *   1. Buat user owner lewat Admin API (idempotent -- diabaikan kalau sudah ada)
 *   2. Jalankan supabase/seed.sql
 *
 * Pakai:
 *   npm run seed                      -> supabase/seed.sql
 *   npm run seed:minggu               -> supabase/seed-minggu.sql
 *   npm run seed -- --file <path>     -> file SQL lain
 *   ... tambahkan --force kalau tabel transactions sudah berisi data.
 *
 * Pengaman: menolak jalan kalau tabel transactions sudah berisi data, karena
 * seed melakukan TRUNCATE. Lewati dengan --force hanya kalau yakin database
 * ini memang database development.
 */
import { readFile } from "node:fs/promises";
import pg from "pg";

const force = process.argv.includes("--force");
const fileArg = process.argv.find((arg) => arg.startsWith("--file="));
const seedFile = fileArg ? fileArg.slice("--file=".length) : "supabase/seed.sql";

/** Dua akun admin dev: satu per role yang ada di tabel admin_users. */
const ADMIN_DEV = [
  { email: "owner@kedaidev.test", password: "dev-owner-2026", nama: "Owner Dev" },
  { email: "admin@kedaidev.test", password: "dev-admin-2026", nama: "Admin Pusat Dev" },
];

const { SUPABASE_DB_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
  process.env;

if (!SUPABASE_DB_URL || !NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Env belum lengkap -- cek .env.local");
  process.exit(1);
}

/**
 * Membuat user di Supabase Auth via Admin API (idempotent). Admin API
 * menolak email yang sudah terdaftar -- itu bukan error di sini.
 */
async function buatUserAuth(email, password) {
  const response = await fetch(`${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });

  if (response.ok) return { ok: true, sudahAda: false };

  const body = await response.json().catch(() => ({}));
  const alreadyExists =
    response.status === 422 ||
    /already been registered|already exists/i.test(body?.msg ?? body?.message ?? "");

  if (alreadyExists) return { ok: true, sudahAda: true };
  return { ok: false, status: response.status, body };
}

// --- 1. User admin di Supabase Auth --------------------------------
for (const akun of ADMIN_DEV) {
  const hasil = await buatUserAuth(akun.email, akun.password);

  if (hasil.ok) {
    console.log(
      `Auth: user ${akun.email} ${hasil.sudahAda ? "sudah ada, dilewati" : "dibuat"}`,
    );
  } else {
    console.error(`Auth: gagal membuat ${akun.email} (HTTP ${hasil.status})`);
    console.error(hasil.body?.msg ?? hasil.body?.message ?? JSON.stringify(hasil.body));
    process.exit(1);
  }
}

// --- 2. Seed data ----------------------------------------------------
const client = new pg.Client({
  connectionString: SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const { rows } = await client.query("select count(*)::int as n from transactions");

  if (rows[0].n > 0 && !force) {
    console.error(
      `Dibatalkan: tabel transactions berisi ${rows[0].n} baris dan seed akan TRUNCATE.`,
    );
    console.error("Kalau ini memang database development, ulangi dengan --force.");
    process.exit(1);
  }

  await client.query(await readFile(seedFile, "utf8"));
  console.log(`Seed: ${seedFile} selesai`);

  const summary = await client.query(`
    select 'kedai' as tabel, count(*)::int as baris from kedai
    union all select 'admin_users', count(*)::int from admin_users
    union all select 'employees',   count(*)::int from employees
    union all select 'products',    count(*)::int from products
    union all select 'shifts',      count(*)::int from shifts
    union all select 'transactions', count(*)::int from transactions
    union all select 'transaction_items', count(*)::int from transaction_items
    union all select 'qris_payments', count(*)::int from qris_payments
    union all select 'void_request', count(*)::int from void_request
    union all select 'waste',       count(*)::int from waste
    union all select 'sisa_fisik',  count(*)::int from sisa_fisik
    union all select 'notifikasi',  count(*)::int from notifikasi
    union all select 'kedai_stock', count(*)::int from kedai_stock
    union all select 'stock_movements', count(*)::int from stock_movements
    union all select 'stock_mutations', count(*)::int from stock_mutations
    union all select 'bahan_mentah', count(*)::int from bahan_mentah
    union all select 'bahan_stock', count(*)::int from bahan_stock
    union all select 'bahan_movement', count(*)::int from bahan_movement
    union all select 'produksi',    count(*)::int from produksi
    union all select 'expenses',    count(*)::int from expenses
    order by tabel
  `);

  console.table(summary.rows);

  const adminRows = await client.query(`
    select name, email, role, is_active from admin_users order by role, email
  `);
  if (adminRows.rows.length) {
    console.log("Akun admin dev yang bisa dipakai untuk login:");
    console.table(adminRows.rows);
  }

  if (summary.rows.find((r) => r.tabel === "admin_users")?.baris === 0) {
    console.error(
      "PERINGATAN: admin_users kosong -- user auth tidak ketemu saat seed dijalankan.",
    );
    process.exitCode = 1;
  }
} finally {
  await client.end();
}
