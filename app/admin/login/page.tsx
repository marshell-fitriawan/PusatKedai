import Link from "next/link";
import { ChevronLeft, Store } from "lucide-react";
import { LoginForm } from "@/components/admin/login-form";

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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <Link
        href="/"
        className="tap-target -ml-2 mb-4 inline-flex w-fit items-center gap-1 px-2 text-sm font-semibold underline underline-offset-4 hover:bg-primary-light"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Kembali
      </Link>

      <div className="mb-6 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center border-2 border-ink bg-primary text-ink shadow-brutal">
          <Store className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-bold">Admin Pusat</h1>
          <p className="text-sm text-text-secondary">
            {process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Sistem Multi-Kedai"}
          </p>
        </div>
      </div>

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

      <p className="mt-4 text-center text-xs text-text-secondary">
        Kasir tidak masuk lewat halaman ini — gunakan scan QR di perangkat
        kedai.
      </p>
    </main>
  );
}
