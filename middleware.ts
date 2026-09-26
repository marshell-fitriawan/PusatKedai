import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/admin/login";

/**
 * Dua tugas:
 *   1. Menyegarkan sesi Supabase Auth di setiap request /admin/*. Tanpa ini
 *      token tidak pernah diperpanjang dan admin ter-logout sendiri di tengah
 *      kerja -- Server Component tidak boleh menulis cookie, jadi hanya
 *      middleware yang bisa melakukannya.
 *   2. Menahan yang belum login sebelum halaman dirender.
 *
 * Middleware SENGAJA hanya memeriksa "sudah login", bukan "berhak". Cek
 * keanggotaan admin_users butuh query database dan dilakukan di layout
 * /admin/(dashboard) lewat requireAdmin(). Memisahkannya begini menjaga
 * middleware tetap ringan -- ia jalan di setiap request.
 *
 * /pos/* tidak diproteksi di sini: karyawan login lewat QR token, bukan
 * Supabase Auth (dikerjakan di M3-4).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLoginPage = pathname === LOGIN_PATH;

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = LOGIN_PATH;
    // Simpan tujuan awal supaya setelah login user kembali ke halaman yang
    // tadi dituju, bukan selalu dilempar ke dashboard.
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectPreservingCookies(url, response);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    url.search = "";
    return redirectPreservingCookies(url, response);
  }

  return response;
}

/**
 * Redirect biasa akan membuang cookie sesi yang baru disegarkan di atas,
 * sehingga user bisa terjebak loop login. Cookie-nya harus ikut dibawa.
 */
function redirectPreservingCookies(url: URL, source: NextResponse) {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of source.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

export const config = {
  matcher: ["/admin/:path*"],
};
