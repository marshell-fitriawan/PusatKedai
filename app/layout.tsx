import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { RegisterServiceWorker } from "@/components/pwa/register-service-worker";
import "./globals.css";

// docs/design_1.md (Neo-Brutalism): dua font dengan peran terpisah.
// Body/UI: Plus Jakarta Sans -- legible di layar kecil, tidak generic-corporate.
// Display/heading: Space Grotesk -- grotesque tegas yang memberi kesan "cetak"
// pada heading brutalism.
//
// `preload: true` ditulis eksplisit meskipun itu default-nya. Alasannya
// bukan behavior, tapi fragilitas: kalau ada yang mengira preloading itu
// opsional lalu menghapusnya, heading POS (yang semuanya Space Grotesk)
// akan ditemukan belakangan dan melompat -- sementara build tetap hijau.
// Eksplisit berarti ada yang perlu diperiksa.
//
// Ukuran yang perlu dijaga: hanya subset `latin` yang benar-benar diunduh
// (26,6 KB Plus Jakarta + 21,8 KB Space Grotesk = 48,4 KB, sudah kompresi).
// Keduanya variable font, jadi semua bobot dilayani satu file dan tidak
// dikalikan jumlah weight. Face untuk cyrillic/vietnamese/latin-ext tetap
// ikut ter-emit di CSS, tapi tidak pernah diunduh browser karena
// `unicode-range`-nya tidak cocok dengan teks Indonesia.
//
// Catatan saat memverifikasi: di Next.js 16 preloads tidak muncul sebagai tag
// <link> di HTML statis, melainkan sebagai hint `HL[...]` di flight payload
// RSC. Jadi untuk mengeceknya cari HL dengan argumen "font", bukan
// rel="preload" di string HTML -- yang itu selalu nol dan menyesatkan.
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

// Space Grotesk adalah variable font -- JANGAN isi `weight`: itu membuat
// Turbopack gagal resolve `@vercel/turbopack-next/internal/font/google/font`
// (next/font hanya boleh menghasilkan satu file per query).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Sistem Multi-Kedai",
  description: "Kasir, stok, shift, dan laporan untuk bisnis multi-cabang",
  // Manifest, favicon (app/icon.svg), dan apple-touch-icon (app/apple-icon.png)
  // semuanya lewat konvensi file Next. JANGAN isi `icons` di sini -- begitu
  // diisi manual, konvensi file diabaikan dan favicon hilang diam-diam.
  appleWebApp: {
    capable: true,
    title: "Multi-Kedai",
    statusBarStyle: "default",
  },
};

// Kasir dipakai di HP sebagai device utama: kunci skala supaya tidak ada
// zoom tidak sengaja saat kerja cepat, dan warna status bar ikut background
// (putih polos, tema neo-brutalism).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${plusJakarta.variable} ${spaceGrotesk.variable} antialiased`}
      >
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
