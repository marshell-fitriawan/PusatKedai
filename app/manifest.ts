import type { MetadataRoute } from "next";

// Next otomatis menyajikan ini di /manifest.webmanifest dan menyisipkan
// <link rel="manifest"> ke <head>, jadi tidak perlu didaftarkan manual.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistem Multi-Kedai",
    short_name: "Multi-Kedai",
    description:
      "Kasir, stok, shift, dan laporan untuk bisnis F&B multi-cabang",
    // PWA di-install di HP kasir, jadi masuk langsung ke halaman jualan --
    // bukan ke landing pemilihan mode.
    start_url: "/pos/kasir",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "id",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
