import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Client Supabase untuk Server Component, Server Action, dan Route Handler.
 *
 * Sesi dibaca dan diperbarui lewat cookie, jadi tetap memakai anon key dan
 * tetap tunduk pada RLS -- identitas pemanggil ikut terbawa.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component tidak boleh menulis cookie. Aman diabaikan
          // selama middleware yang menyegarkan sesi (lihat middleware.ts) --
          // kalau tidak, sesi tidak pernah diperpanjang dan user ter-logout
          // sendiri di tengah kerja.
        }
      },
    },
  });
}
