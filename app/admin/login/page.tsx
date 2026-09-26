import { Store } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";
import { AuthShell } from "@/components/ui/auth-shell";

export const metadata = {
  title: "Masuk — Admin Pusat",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "", error } = await searchParams;

  return (
    <AuthShell
      title="Admin Pusat"
      clientName={process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Sistem Multi-Kedai"}
      icon={Store}
      backHref="/"
      headline="Kelola semua kedai dari satu tempat."
      tagline="Masuk sebagai owner atau admin pusat untuk melihat omzet gabungan, mengatur stok, dan menyetujui mutasi antar kedai."
      points={[
        "Laporan omzet dan laba-rugi gabungan semua cabang",
        "Stok dan mutasi antar kedai dengan persetujuan",
        "Data karyawan, shift, dan rekonsiliasi kas per kedai",
        "Kelola produk, harga, dan bahan baku dari pusat",
      ]}
      hint={
        <>
          Kasir tidak masuk lewat halaman ini — gunakan scan QR di
          perangkat kedai.
        </>
      }
    >
      <div className="border-2 border-ink bg-surface p-6 shadow-brutal">
        {error === "forbidden" ? (
          <p
            role="alert"
            className="mb-4 border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink"
          >
            Sesi berakhir atau akun tidak punya akses admin. Silakan masuk
            kembali.
          </p>
        ) : null}

        <LoginForm next={next} />
      </div>
    </AuthShell>
  );
}
