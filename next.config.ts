import type { NextConfig } from "next";

/**
 * Hostname Supabase berbeda di tiap instance klien, jadi diturunkan dari env
 * -- bukan ditulis mati. Kalau ditulis mati, gambar produk klien kedua tidak
 * akan tampil dan penyebabnya tidak jelas dari pesan errornya.
 */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    // next/image menolak URL dari host yang tidak terdaftar di sini.
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
