"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { tandaiBaca } from "@/app/admin/(dashboard)/perhatian/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type BarisNotifikasi = {
  id: string;
  type: "shift_selesai" | "selisih" | "stock_low" | "void_review" | "device_stale" | "assign" | "produksi";
  title: string;
  message: string | null;
  isRead: boolean;
  createdAt: string;
  kedaiNama: string | null;
};

const labelJenis: Record<BarisNotifikasi["type"], string> = {
  shift_selesai: "Penutupan",
  selisih: "Selisih",
  stock_low: "Stok menipis",
  void_review: "Pembatalan menunggu",
  device_stale: "Antrian belum terkirim",
  assign: "Mutasi stok",
  produksi: "Produksi",
};

const toneJenis: Record<BarisNotifikasi["type"], "success" | "warning" | "danger" | "info" | "neutral"> = {
  shift_selesai: "success",
  selisih: "danger",
  stock_low: "warning",
  void_review: "warning",
  device_stale: "warning",
  assign: "info",
  produksi: "info",
};

function Kartu({ n }: { n: BarisNotifikasi }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const res = await tandaiBaca(n.id, !n.isRead);
      if (!res.error) router.refresh();
    });
  }

  return (
    <li
      className={`flex items-start gap-3 border-b-2 border-ink py-3 ${
        n.isRead ? "opacity-60" : ""
      }`}
    >
      <Badge tone={toneJenis[n.type]} className="mt-0.5 shrink-0">
        {labelJenis[n.type]}
      </Badge>

      <div className="min-w-0 flex-1">
        <p className="font-semibold">{n.title}</p>
        {n.message ? (
          <p className="text-sm text-text-secondary">{n.message}</p>
        ) : null}
        <p className="mt-1 text-xs text-text-secondary">
          {new Intl.DateTimeFormat("id-ID", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(n.createdAt))}
          {n.kedaiNama ? ` · ${n.kedaiNama}` : ""}
        </p>
      </div>

      <Button variant="ghost" size="sm" disabled={pending} onClick={toggle}>
        {n.isRead ? (
          <Circle className="size-4" aria-hidden />
        ) : (
          <CheckCircle2 className="size-4" aria-hidden />
        )}
        {n.isRead ? "Belum dibaca" : "Tandai dibaca"}
      </Button>
    </li>
  );
}

export function NotifikasiList({ items }: { items: BarisNotifikasi[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Tidak ada notifikasi. Semua aman.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-ink">
      {items.map((n) => (
        <Kartu key={n.id} n={n} />
      ))}
    </ul>
  );
}