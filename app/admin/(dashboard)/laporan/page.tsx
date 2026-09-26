import Link from "next/link";
import { ArrowRight, Boxes, CalendarDays, TrendingUp } from "lucide-react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Laporan — Admin Pusat" };

export default async function LaporanPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Laporan</h1>
        <p className="text-sm text-text-secondary">
          Konsolidasi lintas cabang: ringkasan harian, stok, dan untung-rugi.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link href="/admin/laporan/harian">
          <Card className="h-full transition-colors hover:bg-primary-light">
            <div className="flex items-center gap-3">
              <span className="border-2 border-ink bg-success p-3 text-ink">
                <CalendarDays className="size-6" aria-hidden />
              </span>
              <div className="flex-1">
                <CardTitle>Ringkasan Harian</CardTitle>
                <CardDescription>
                  Omzet, pembatalan, dan yang menunggu keputusan per tanggal ×
                  kedai, plus rasio pembatalan per karyawan.
                </CardDescription>
              </div>
              <ArrowRight className="size-5 shrink-0 text-text-secondary" aria-hidden />
            </div>
          </Card>
        </Link>
        <Link href="/admin/laporan/stok">
          <Card className="h-full transition-colors hover:bg-primary-light">
            <div className="flex items-center gap-3">
              <span className="border-2 border-ink bg-info p-3 text-white">
                <Boxes className="size-6" aria-hidden />
              </span>
              <div className="flex-1">
                <CardTitle>Stok Konsolidasi</CardTitle>
                <CardDescription>
                  Semua produk, posisi stok di tiap kedai berdampingan, plus
                  tanda habis / menipis.
                </CardDescription>
              </div>
              <ArrowRight className="size-5 shrink-0 text-text-secondary" aria-hidden />
            </div>
          </Card>
        </Link>
        <Link href="/admin/laporan/laba-rugi">
          <Card className="h-full transition-colors hover:bg-primary-light">
            <div className="flex items-center gap-3">
              <span className="border-2 border-ink bg-primary p-3 text-ink">
                <TrendingUp className="size-6" aria-hidden />
              </span>
              <div className="flex-1">
                <CardTitle>Untung-Rugi Kasar</CardTitle>
                <CardDescription>
                  Omzet dikurangi pengeluaran tercatat per kedai, per rentang
                  tanggal.
                </CardDescription>
              </div>
              <ArrowRight className="size-5 shrink-0 text-text-secondary" aria-hidden />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}