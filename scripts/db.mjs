/**
 * Runner SQL untuk database Supabase.
 *
 * Dipakai untuk verifikasi skema, uji constraint, dan seed -- hal-hal yang
 * tidak bisa dilakukan lewat REST API.
 *
 * Pakai:
 *   npm run db -- supabase/tests/constraints.sql
 *   npm run db -- -e "select count(*) from kedai"
 *
 * Koneksi diambil dari SUPABASE_DB_URL di .env.local (dimuat lewat
 * --env-file, lihat script "db" di package.json).
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import pg from "pg";

const [arg, inline] = process.argv.slice(2);

if (!arg) {
  console.error("usage: npm run db -- <file.sql>");
  console.error('       npm run db -- -e "SELECT 1"');
  process.exit(1);
}

if (!process.env.SUPABASE_DB_URL) {
  console.error("SUPABASE_DB_URL kosong -- cek .env.local");
  process.exit(1);
}

let sql = arg === "-e" ? inline : await readFile(arg, "utf8");

// Test DB memakai UUID kanonik dari seed.sql yang tidak selalu ada
// (contoh: DB dev di-seed dengan seed:minggu). Baris penanda
// `-- @include _fixtures.sql` di dalam file uji diganti dengan isi
// _fixtures.sql di direktori yang sama -- masih di dalam transaction
// file itu, jadi ikut rollback.
if (sql.includes("-- @include _fixtures.sql")) {
  const fixtures = await readFile(join(dirname(arg), "_fixtures.sql"), "utf8");
  sql = sql.replace("-- @include _fixtures.sql", fixtures.trim());
}

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  // Supabase mewajibkan TLS. Sertifikatnya ditandatangani CA internal
  // Supabase, jadi verifikasi rantai dimatikan -- ini koneksi dari mesin
  // developer ke database milik sendiri, bukan jalur data aplikasi.
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const result = await client.query(sql);
  for (const r of Array.isArray(result) ? result : [result]) {
    if (r.rows?.length) console.table(r.rows);
    else console.log(`${r.command ?? "OK"}${r.rowCount == null ? "" : ` (${r.rowCount} baris)`}`);
  }
} catch (error) {
  // Untuk uji constraint, error justru hasil yang diharapkan -- tampilkan
  // ringkas dan kembalikan exit code supaya bisa dipakai di skrip lain.
  console.error(`${error.code ?? "ERROR"}: ${error.message}`);
  if (error.constraint) console.error(`constraint: ${error.constraint}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
