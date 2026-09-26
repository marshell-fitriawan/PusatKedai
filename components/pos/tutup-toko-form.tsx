"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle, DoorClosed } from "lucide-react";
import { tutupToko, type HasilTutup } from "@/app/pos/(kasir)/shift/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { db } from "@/lib/offline/db";

/**
 * Form tutup toko.
 *
 * Jumlah transaksi yang masih mengantre dibaca dari IndexedDB perangkat ini
 * -- server tidak punya cara mengetahuinya. Angka itu dikirim bersama kas
 * akhir supaya server tahu apakah selisih kasnya sudah boleh dianggap sah.
 *
 * Kasir TIDAK diblokir saat antrian belum kosong. Internet mati total adalah
 * kejadian nyata, dan toko tetap harus bisa tutup.
 */
export function TutupTokoForm({ kedaiId }: { kedaiId: string }) {
  const router = useRouter();
  const [terbuka, setTerbuka] = useState(false);
  const [kas, setKas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasil, setHasil] = useState<HasilTutup | null>(null);
  const [pending, startTransition] = useTransition();

  const tertunda =
    useLiveQuery(
      () => db.antrian.where("kedaiId").equals(kedaiId).count(),
      [kedaiId],
      0,
    ) ?? 0;

  function kirim() {
    setError(null);

    startTransition(async () => {
      const res = await tutupToko(Number(kas || 0), tertunda);
      if (res.error) {
        setError(res.error);
        return;
      }
      setHasil(res);
      router.refresh();
    });
  }

  if (hasil) {
    const belumFinal = hasil.status === "pending_sync";

    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Toko Ditutup</h2>

        <p className="border-2 border-ink bg-success p-3 text-sm font-semibold text-ink">
          Terima kasih, shift berhasil ditutup. Data kas aman di server — angka
          setoran dan selisihnya hanya bisa dilihat pemilik.
        </p>

        {belumFinal ? (
          <div className="border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink">
            <Badge tone="warning">Belum final</Badge>
            <p className="mt-2">
              Masih ada {hasil.tertunda} transaksi di perangkat ini yang belum
              terkirim. Perhitungan setoran baru sah setelah semuanya masuk.
            </p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <Button variant="secondary" fullWidth onClick={() => setTerbuka(true)}>
        <DoorClosed className="size-5" aria-hidden />
        Tutup Toko
      </Button>

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title="Tutup Toko"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setTerbuka(false)}
            >
              Batal
            </Button>
            <Button disabled={pending || kas === ""} onClick={kirim}>
              {pending ? "Menutup..." : "Tutup Toko"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Kas fisik di laci"
            numeric
            value={kas}
            onChange={(e) => setKas(e.target.value)}
            placeholder="1750000"
            hint="Hitung uang sungguhan, jangan menyalin angka sistem"
            autoFocus
          />

          {tertunda > 0 ? (
            <p className="border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink">
              Ada <strong>{tertunda} transaksi</strong> yang belum terkirim ke
              server. Toko tetap bisa ditutup — selisih kas akan dihitung
              ulang otomatis begitu antrian terkirim.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
