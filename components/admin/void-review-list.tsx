"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Ban } from "lucide-react";
import { putuskanVoid } from "@/app/admin/(dashboard)/void/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatUang } from "@/lib/utils";

export type BarisReview = {
  requestId: string;
  transactionNumber: string;
  kedai: string;
  employee: string;
  total: number;
  waktu: string;
  alasan: string;
};

const waktu = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function VoidReviewList({ baris }: { baris: BarisReview[] }) {
  const router = useRouter();
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [menolak, setMenolak] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function putuskan(r: BarisReview, approve: boolean) {
    setError(null);
    setPendingId(r.requestId);
    startTransition(async () => {
      const res = await putuskanVoid(r.requestId, approve, catatan[r.requestId] ?? "");
      if (res.error) {
        setError(res.error);
        setPendingId(null);
        return;
      }
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {baris.map((r) => (
        <Card key={r.requestId} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold tabular-nums">
                #{r.transactionNumber}
              </p>
              <p className="text-sm text-text-secondary">
                {r.kedai} · {r.employee} · {waktu.format(new Date(r.waktu))} ·
                total {formatUang(r.total)}
              </p>
            </div>
            <Ban
              className="size-5 shrink-0 text-warning-text"
              aria-hidden
            />
          </div>

          <div className="border-2 border-ink bg-surface p-3">
            <p className="text-sm font-semibold">Alasan kasir</p>
            <p className="mt-1 text-sm">{r.alasan}</p>
          </div>

          {menolak[r.requestId] ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                Alasan penolakan <span className="font-normal text-text-secondary">(wajib)</span>
              </span>
              <textarea
                autoFocus
                value={catatan[r.requestId] ?? ""}
                onChange={(e) =>
                  setCatatan((c) => ({ ...c, [r.requestId]: e.target.value }))
                }
                rows={2}
                placeholder="cth. transaksi itu sudah benar, jangan dibatalkan"
                className="border-2 border-ink bg-surface px-3 py-2 text-base"
              />
            </label>
          ) : null}

          <div className="flex justify-end gap-2">
            {menolak[r.requestId] ? (
              <>
                <Button
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => {
                    setMenolak((m) => ({ ...m, [r.requestId]: false }));
                    setCatatan((c) => ({ ...c, [r.requestId]: "" }));
                  }}
                >
                  Batal
                </Button>
                <Button
                  variant="danger"
                  disabled={isPending || !(catatan[r.requestId] ?? "").trim()}
                  onClick={() => putuskan(r, false)}
                >
                  {pendingId === r.requestId && isPending
                    ? "Memproses..."
                    : "Tolak & Simpan"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => setMenolak((m) => ({ ...m, [r.requestId]: true }))}
                >
                  Tolak
                </Button>
                <Button
                  variant="danger"
                  disabled={isPending}
                  onClick={() => putuskan(r, true)}
                >
                  {pendingId === r.requestId && isPending ? "Memproses..." : "Setujui & Batalkan"}
                </Button>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}