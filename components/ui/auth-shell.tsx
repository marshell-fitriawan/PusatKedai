import Link from "next/link";
import { ChevronLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type AuthShellProps = {
  /** Nama modul, misalnya "Admin Pusat". Ditampilkan di kolom kanan. */
  title: string;
  /** Nama client, dari NEXT_PUBLIC_CLIENT_NAME. */
  clientName: string;
  /** Ikon modul. */
  icon: LucideIcon;
  /**
   * Panel kiri, hanya tampil di layar lebar. Isinya penjelasan, bukan
   * pengulangan nama produk -- supaya tidak ada teks yang muncul dua kali.
   */
  headline: string;
  tagline: string;
  points: string[];
  /** Isi kolom kanan: kartu form atau kartu pilihan. */
  children: ReactNode;
  /** Kalimat kecil di bawah kartu. */
  hint?: ReactNode;
  /** Kalau diisi, tombol "Kembali" muncul di atas kolom kanan. */
  backHref?: string;
};

/**
 * Kerangka halaman yang butuh login atau memilih akses.
 *
 * Kenapa tidak pakai `max-w-sm` di tengah layar seperti di HP:
 * di monitor 1440px, kolom selebar 384px terlihat seperti kartu yang
 * melayang tanpa konteks. Solusinya memecah layar jadi dua kolom sejak
 * `lg` (1024px): kiri menjelaskan sistemnya, kanan mengerjakan tugasnya.
 *
 * Di bawah `lg` panel kiri disembunyikan, bukan dipotong. Di HP tidak ada
 * ruang untuk dua kolom, dan penjelasan tidak boleh membuat form
 * terdorong ke bawah layar.
 *
 * Breakpoint `lg` (1024px) sama dengan POS dan sidebar admin supaya
 * seluruh aplikasi berpindah bentuk di lebar yang sama.
 */
export function AuthShell({
  title,
  clientName,
  icon: Icon,
  headline,
  tagline,
  points,
  children,
  hint,
  backHref,
}: AuthShellProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/*
        Kolom kiri. `border-r-2` digabung dengan `border-ink` supaya garis
        pemisah ikut brutalism, bukan abu-abu tipis.
      */}
      <aside className="hidden flex-col justify-center border-r-2 border-ink bg-primary p-8 lg:flex xl:p-12">
        <h2 className="text-3xl font-bold">{headline}</h2>
        <p className="mt-4 max-w-md text-base text-ink">{tagline}</p>

        <ul className="mt-8 flex flex-col gap-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span
                aria-hidden
                className="mt-1 size-3 shrink-0 border-2 border-ink bg-surface"
              />
              <span className="text-base">{point}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/*
        Kolom kanan. Di mobile ini satu-satunya kolom, jadi `justify-center`
        menengahkan isinya seperti sebelumnya. Di layar lebar, panel kiri
        yang memberi bobot visual, sehingga kolom kanan boleh rata atas
        dengan padding yang lebih longgar.
      */}
      <main className="flex flex-col justify-center px-4 py-8 lg:px-8 lg:py-12 xl:px-12">
        {backHref ? (
          <Link
            href={backHref}
            className="tap-target -ml-2 mb-4 inline-flex w-fit items-center gap-1 px-2 text-sm font-semibold underline underline-offset-4 hover:bg-primary-light"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Kembali
          </Link>
        ) : null}

        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center border-2 border-ink bg-primary text-ink shadow-brutal">
            <Icon className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="text-sm text-text-secondary">{clientName}</p>
          </div>
        </div>

        {children}

        {hint ? (
          <p className="mt-4 text-center text-xs text-text-secondary">
            {hint}
          </p>
        ) : null}
      </main>
    </div>
  );
}
