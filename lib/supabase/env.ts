/**
 * Pembacaan environment variable Supabase dengan pesan gagal yang jelas.
 *
 * Tanpa ini, env yang belum diisi menghasilkan error dari dalam library
 * ("Invalid URL", "supabaseKey is required") yang tidak menyebut variabel mana
 * yang bermasalah -- membuang waktu saat provisioning instance klien baru.
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Environment variable ${name} belum diisi. Lihat .env.example dan docs/provisioning.md.`,
    );
  }
  return value;
}

export function supabaseUrl() {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

export function supabaseAnonKey() {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function supabaseServiceRoleKey() {
  return required(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
