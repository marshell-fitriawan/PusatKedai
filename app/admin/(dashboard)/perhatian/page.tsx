import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  NotifikasiList,
  type BarisNotifikasi,
} from "@/components/admin/notifikasi-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUang } from "@/lib/utils";

export const metadata = { title: "Perlu Perhatian" };

const tgl = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function PerhatianPage() {
  await requireAdmin();
  const db = createAdminClient();

  const [notifRes, selisihRes, syncRes] = await Promise.all([
    db
      .from("notifikasi")
      .select("*, kedai:kedai_id(name)")
      .order("created_at", { ascending: false })
      .limit(100),
    // Selisih sesi yang belum diselesaikan pemilik (M8-4): final tapi masih
    // `terbuka`. Dihitung langsung dari shifts supaya selalu aktual, bukan
    // bergantung pada ada-tidaknya notifikasi.
    db.from("shifts")
      .select("id, business_date, closed_at, cash_difference, kedai:kedai_id(name)")
      .eq("reconciliation_status", "final")
      .eq("difference_status", "terbuka")
      .order("closed_at", { ascending: false })
      .limit(15),
    // Perangkat menunggak sinkron (M8-4): sesi sudah ditutup tapi masih ada
    // transaksi di antrian offline. Paling lama paling atas = paling dicurigai.
    db.from("shifts")
      .select("id, kedai_id, business_date, closed_at, pending_sync_count, kedai:kedai_id(name)")
      .eq("status", "closed")
      .eq("reconciliation_status", "pending_sync")
      .gt("pending_sync_count", 0)
      .order("closed_at", { ascending: true })
      .limit(15),
  ]);

  const items: BarisNotifikasi[] = (notifRes.data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.is_read,
    createdAt: n.created_at,
    kedaiNama: (n as unknown as { kedai?: { name: string } }).kedai?.name ?? null,
  }));

  const selisih = (selisihRes.data ?? []).filter(
    (s) => s.cash_difference !== null && Number(s.cash_difference) !== 0,
  );
  const tersendat = syncRes.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Perlu Perhatian</h1>
      <p className="text-sm text-text-secondary">
        Penutupan toko, selisih kas, dan peringatan lain yang perlu dilihat
        pemilik. Item belum dibaca dihitung sebagai badge di menu.
      </p>

      <NotifikasiList items={items} />

      <h2 className="pt-2 text-lg font-semibold">Kas belum dibereskan</h2>
      <p className="text-sm text-text-secondary">
        Penutupan toko yang masih punya selisih kas. Kalau selisihnya sudah
        nol, penutupan itu otomatis hilang dari daftar ini.
      </p>
      {selisih.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">Tidak ada yang perlu dibereskan.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-ink">
            {selisih.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div>
                  <p className="font-semibold">
                    {(s as unknown as { kedai?: { name: string } }).kedai?.name ?? "Kedai"}
                    <span className="ml-2 text-sm font-normal text-text-secondary">
                      {tgl.format(new Date(`${s.business_date}T00:00:00`))}
                    </span>
                  </p>
                  <p className="text-xs text-text-secondary">
                    Ditutup {s.closed_at ? tgl.format(new Date(s.closed_at)) : "?"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="danger" className="tabular-nums">
                    {formatUang(Number(s.cash_difference))}
                  </Badge>
                  <Link href="/admin/collect">
                    <Button size="sm" variant="secondary">
                      Buka Setoran
                      <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <h2 className="pt-2 text-lg font-semibold">Antrian belum terkirim</h2>
      <p className="text-sm text-text-secondary">
        Toko sudah ditutup, tapi masih ada transaksi di perangkat yang belum
        masuk ke server. Hitungan penutupannya belum bisa dianggap pasti sampai
        semuanya terkirim — semakin lama menganggur, semakin dicurigai.
      </p>
      {tersendat.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Semua perangkat sudah sinkron.
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-ink">
            {tersendat.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div>
                  <p className="font-semibold">
                    {(s as unknown as { kedai?: { name: string } }).kedai?.name ?? "Kedai"}
                    <span className="ml-2 text-sm font-normal text-text-secondary">
                      {tgl.format(new Date(`${s.business_date}T00:00:00`))}
                    </span>
                  </p>
                  <p className="text-xs text-text-secondary">
                    Tutup{" "}
                    {s.closed_at
                      ? new Intl.DateTimeFormat("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(s.closed_at))
                      : "?"}
                  </p>
                </div>
                <Badge tone="warning">
                  {s.pending_sync_count} antrian tersisa
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}