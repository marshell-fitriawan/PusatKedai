"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, X } from "lucide-react";
import {
  setujuiMutasi,
  tolakMutasi,
} from "@/app/admin/(dashboard)/mutasi/actions";
import type { MutasiItem } from "@/app/admin/(dashboard)/mutasi/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const toneStatus: Record<MutasiItem["status"], "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export function MutasiList({
  mutasi,
  statusTerpilih,
  statusLabel,
  error,
}: {
  mutasi: MutasiItem[];
  statusTerpilih: string;
  statusLabel: Record<string, string>;
  error: string | null;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [penolakan, setPenolakan] = useState<MutasiItem | null>(null);
  const [alasan, setAlasan] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [menolak, startTolak] = useTransition();

  function setujui(id: string) {
    setPendingId(id);
    startTolak(async () => {
      const res = await setujuiMutasi(id);
      if (res.error) alert(res.error);
      setPendingId(null);
      router.refresh();
    });
  }

  function tolak() {
    if (!penolakan) return;
    setErrorForm(null);

    startTolak(async () => {
      const res = await tolakMutasi(penolakan.id, alasan);
      if (res.error) {
        setErrorForm(res.error);
        return;
      }
      setPenolakan(null);
      setAlasan("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mutasi Stok</h1>
          <p className="text-sm text-text-secondary">
            Perpindahan stok antar kedai — disetujui di sini, dieksekusi satu
            transaksi atomik
          </p>
        </div>

        <div className="min-w-44">
          <Select
            label="Status"
            value={statusTerpilih}
            onChange={(e) => {
              const v = e.target.value;
              router.push(v ? `/admin/mutasi?status=${v}` : "/admin/mutasi");
            }}
            options={[
              { value: "pending", label: "Menunggu" },
              { value: "approved", label: "Disetujui" },
              { value: "rejected", label: "Ditolak" },
              { value: "", label: "Semua" },
            ]}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink"
        >
          Gagal memuat mutasi: {error}
        </p>
      ) : null}

      {mutasi.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Tidak ada mutasi berstatus {statusLabel[statusTerpilih] ?? "ini"}.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu bertumpuk */}
          <div className="flex flex-col gap-3 lg:hidden">
            {mutasi.map((m) => (
              <Card
                key={m.id}
                className={`flex flex-col gap-2 ${m.status === "pending" ? "bg-primary-light" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {m.produk?.name ?? "Produk terhapus"}
                      <span className="text-text-secondary"> ×{m.quantity}</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      {m.dari?.name ?? "—"} → {m.tujuan?.name ?? "—"}
                    </p>
                  </div>
                  <Badge tone={toneStatus[m.status]} className="shrink-0">
                    {statusLabel[m.status] ?? m.status}
                  </Badge>
                </div>

                <dl className="border-2 border-ink bg-surface-alt p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-text-secondary">Diajukan</dt>
                    <dd>{tanggal.format(new Date(m.requested_at))}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <dt className="text-text-secondary">Pengaju</dt>
                    <dd className="text-right">{m.pengaju?.name ?? "—"}</dd>
                  </div>
                  {m.note ? (
                    <div className="flex items-start justify-between gap-2">
                      <dt className="shrink-0 text-text-secondary">Catatan</dt>
                      <dd className="text-right italic">{m.note}</dd>
                    </div>
                  ) : null}
                </dl>

                {m.status === "pending" ? (
                  <div className="flex flex-wrap gap-2 border-t-2 border-ink pt-2">
                    <Button
                      size="sm"
                      disabled={pendingId === m.id}
                      onClick={() => setujui(m.id)}
                      aria-label={`Setujui mutasi ${m.produk?.name ?? ""}`}
                    >
                      <Check className="size-4" aria-hidden />
                      Setujui
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pendingId === m.id}
                      onClick={() => {
                        setPenolakan(m);
                        setAlasan("");
                        setErrorForm(null);
                      }}
                      aria-label={`Tolak mutasi ${m.produk?.name ?? ""}`}
                    >
                      <X className="size-4" aria-hidden />
                      Tolak
                    </Button>
                  </div>
                ) : (
                  <div className="border-t-2 border-ink pt-2" />
                )}
              </Card>
            ))}
          </div>

          {/* Desktop: tabel */}
          <Card className="hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Dari</TH>
                    <TH>Ke</TH>
                    <TH>Produk</TH>
                    <TH numeric>Jumlah</TH>
                    <TH>Pengaju</TH>
                    <TH>Diajukan</TH>
                    <TH>Catatan</TH>
                    <TH>Status</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {mutasi.map((m) => (
                    <TR key={m.id} className={m.status === "pending" ? "bg-primary-light" : ""}>
                      <TD className="font-semibold">{m.dari?.name ?? "—"}</TD>
                      <TD className="font-semibold">{m.tujuan?.name ?? "—"}</TD>
                      <TD>{m.produk?.name ?? "—"}</TD>
                      <TD numeric>{m.quantity}</TD>
                      <TD className="text-text-secondary">{m.pengaju?.name ?? "—"}</TD>
                      <TD className="text-text-secondary">
                        {tanggal.format(new Date(m.requested_at))}
                      </TD>
                      <TD className="max-w-56 truncate text-text-secondary" title={m.note ?? undefined}>
                        {m.note ?? "—"}
                      </TD>
                      <TD>
                        <Badge tone={toneStatus[m.status]}>
                          {statusLabel[m.status] ?? m.status}
                        </Badge>
                      </TD>
                      <TD>
                        {m.status === "pending" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={pendingId === m.id}
                              onClick={() => setujui(m.id)}
                              aria-label={`Setujui mutasi ${m.produk?.name ?? ""}`}
                            >
                              <Check className="size-4" aria-hidden />
                              Setujui
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={pendingId === m.id}
                              onClick={() => {
                                setPenolakan(m);
                                setAlasan("");
                                setErrorForm(null);
                              }}
                              aria-label={`Tolak mutasi ${m.produk?.name ?? ""}`}
                            >
                              <X className="size-4" aria-hidden />
                              Tolak
                            </Button>
                          </div>
                        ) : null}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <p className="text-xs text-text-secondary">
        Persetujuan memindahkan stok secara utuh dalam satu langkah: jumlah di
        kedai asal dan tujuan diubah bersamaan dengan jejaknya. Kalau stok
        kedai asal tidak mencukupi, persetujuan ditolak otomatis.
      </p>

      <Modal
        open={penolakan !== null}
        onClose={() => setPenolakan(null)}
        title={`Tolak Mutasi${penolakan ? ` — ${penolakan.produk?.name ?? ""}` : ""}`}
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button
              variant="secondary"
              disabled={menolak}
              onClick={() => setPenolakan(null)}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              disabled={menolak || alasan.trim().length < 3}
              onClick={tolak}
            >
              {menolak ? "Menyimpan..." : "Tolak Mutasi"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Alasan penolakan"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            placeholder="Stok kedai asal habis, tunda pekan depan"
            hint="Wajib diisi dan tercatat di riwayat mutasi"
            autoFocus
          />

          {errorForm ? (
            <p
              role="alert"
              className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {errorForm}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}