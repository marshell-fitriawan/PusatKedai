"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { setKedaiActive } from "@/app/admin/(dashboard)/kedai/actions";
import { KedaiForm } from "@/components/admin/kedai-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Tables } from "@/lib/database.types";

type Kedai = Tables<"kedai">;

export function KedaiList({ data }: { data: Kedai[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Kedai | undefined>();
  const [pending, startTransition] = useTransition();

  function openTambah() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openUbah(kedai: Kedai) {
    setEditing(kedai);
    setFormOpen(true);
  }

  function toggleAktif(kedai: Kedai) {
    startTransition(async () => {
      await setKedaiActive(kedai.id, !kedai.is_active);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kedai</h1>
          <p className="text-sm text-text-secondary">
            {data.length} cabang terdaftar
          </p>
        </div>

        <Button onClick={openTambah}>
          <Plus className="size-4" aria-hidden />
          Tambah Kedai
        </Button>
      </div>

      {data.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Belum ada kedai. Tambahkan cabang pertama untuk mulai memakai
            sistem.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu bertumpuk */}
          <div className="flex flex-col gap-3 lg:hidden">
            {data.map((kedai) => (
              <Card key={kedai.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{kedai.name}</span>
                      {kedai.is_warehouse ? (
                        <Badge tone="info" className="shrink-0">Gudang</Badge>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-text-secondary">
                      {kedai.address ?? "Tanpa alamat"}
                    </p>
                  </div>
                  <span className="shrink-0">
                    {kedai.is_active ? (
                      <Badge tone="success">Aktif</Badge>
                    ) : (
                      <Badge tone="neutral">Nonaktif</Badge>
                    )}
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-2 border-2 border-ink bg-surface-alt p-2 text-xs">
                  <div>
                    <dt className="text-text-secondary">Telepon</dt>
                    <dd className="truncate">{kedai.phone ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Zona waktu</dt>
                    <dd>{kedai.timezone}</dd>
                  </div>
                  <div>
                    <dt className="text-text-secondary">Ambang stok</dt>
                    <dd className="tabular-nums">{kedai.low_stock_threshold}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 border-t-2 border-ink pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openUbah(kedai)}
                    aria-label={`Ubah ${kedai.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                    Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => toggleAktif(kedai)}
                    aria-label={`${kedai.is_active ? "Nonaktifkan" : "Aktifkan"} ${kedai.name}`}
                  >
                    <Power className="size-4" aria-hidden />
                    {kedai.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop: tabel */}
          <Card className="hidden p-0 lg:block">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Nama</TH>
                    <TH>Alamat</TH>
                    <TH>Telepon</TH>
                    <TH>Zona waktu</TH>
                    <TH numeric>Ambang stok</TH>
                    <TH>Status</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.map((kedai) => (
                    <TR key={kedai.id}>
                      <TD className="font-semibold">
                        <span className="flex items-center gap-2">
                          {kedai.name}
                          {kedai.is_warehouse ? <Badge tone="info">Gudang</Badge> : null}
                        </span>
                      </TD>
                      <TD className="text-text-secondary">
                        {kedai.address ?? "—"}
                      </TD>
                      <TD className="text-text-secondary">
                        {kedai.phone ?? "—"}
                      </TD>
                      <TD className="text-text-secondary">{kedai.timezone}</TD>
                      <TD numeric>{kedai.low_stock_threshold}</TD>
                      <TD>
                        {kedai.is_active ? (
                          <Badge tone="success">Aktif</Badge>
                        ) : (
                          <Badge tone="neutral">Nonaktif</Badge>
                        )}
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openUbah(kedai)}
                            aria-label={`Ubah ${kedai.name}`}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Ubah
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => toggleAktif(kedai)}
                            aria-label={`${kedai.is_active ? "Nonaktifkan" : "Aktifkan"} ${kedai.name}`}
                          >
                            <Power className="size-4" aria-hidden />
                            {kedai.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
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
        Kedai tidak bisa dihapus — hanya dinonaktifkan. Transaksi, shift, dan
        stok yang sudah terjadi tetap merujuk ke kedai ini, dan riwayat itu
        harus tetap utuh.
      </p>

      {/* key memaksa form dibuat ulang saat berganti target, supaya
          defaultValue ikut berubah. Tanpa ini, isian kedai sebelumnya
          tertinggal di form. */}
      <KedaiForm
        key={editing?.id ?? "baru"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        kedai={editing}
      />
    </div>
  );
}
