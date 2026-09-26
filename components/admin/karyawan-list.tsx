"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { KeyRound, Pencil, Plus, Power, QrCode } from "lucide-react";
import {
  resetQrToken,
  setKaryawanActive,
} from "@/app/admin/(dashboard)/karyawan/actions";
import type { KaryawanItem } from "@/app/admin/(dashboard)/karyawan/page";
import { KaryawanForm } from "@/components/admin/karyawan-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function KaryawanList({
  daftarKedai,
  karyawan,
}: {
  daftarKedai: { id: string; name: string }[];
  karyawan: KaryawanItem[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KaryawanItem>();
  const [resetTarget, setResetTarget] = useState<KaryawanItem>();
  const [pending, startTransition] = useTransition();

  function openTambah() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openUbah(item: KaryawanItem) {
    setEditing(item);
    setFormOpen(true);
  }

  function toggleAktif(item: KaryawanItem) {
    startTransition(async () => {
      await setKaryawanActive(item.id, !item.is_active);
    });
  }

  function konfirmasiReset() {
    if (!resetTarget) return;
    startTransition(async () => {
      await resetQrToken(resetTarget.id);
      setResetTarget(undefined);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Karyawan</h1>
          <p className="text-sm text-text-secondary">
            {karyawan.length} karyawan terdaftar
          </p>
        </div>

        <Button onClick={openTambah}>
          <Plus className="size-4" aria-hidden />
          Tambah Karyawan
        </Button>
      </div>

      {karyawan.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Belum ada karyawan. Tambahkan dulu untuk mencetak kartu QR-nya.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu bertumpuk */}
          <div className="flex flex-col gap-3 lg:hidden">
            {karyawan.map((item) => (
              <Card key={item.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="truncate text-xs text-text-secondary">
                      {item.kedai?.name ?? "Tanpa kedai"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.role === "kasir" ? (
                      <Badge tone="info">Kasir</Badge>
                    ) : (
                      <Badge tone="neutral">Kepala Kedai</Badge>
                    )}
                    {item.is_active ? (
                      <Badge tone="success">Aktif</Badge>
                    ) : (
                      <Badge tone="neutral">Nonaktif</Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t-2 border-ink pt-2">
                  <Link
                    href={`/admin/karyawan/${item.id}`}
                    className="inline-flex h-9 items-center gap-2 border-2 border-ink bg-surface px-3 font-display text-xs font-bold uppercase tracking-tight text-ink shadow-brutal-sm press-brutal hover:bg-primary-light"
                  >
                    <QrCode className="size-4" aria-hidden />
                    Kartu QR
                  </Link>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openUbah(item)}
                    aria-label={`Ubah ${item.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                    Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setResetTarget(item)}
                    aria-label={`Terbitkan kartu QR baru untuk ${item.name}`}
                  >
                    <KeyRound className="size-4" aria-hidden />
                    Kartu Baru
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => toggleAktif(item)}
                    aria-label={`${item.is_active ? "Nonaktifkan" : "Aktifkan"} ${item.name}`}
                  >
                    <Power className="size-4" aria-hidden />
                    {item.is_active ? "Nonaktifkan" : "Aktifkan"}
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
                    <TH>Kedai</TH>
                    <TH>Peran</TH>
                    <TH>Status</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {karyawan.map((item) => (
                    <TR key={item.id}>
                      <TD className="font-semibold">{item.name}</TD>
                      <TD className="text-text-secondary">
                        {item.kedai?.name ?? "—"}
                      </TD>
                      <TD>
                        {item.role === "kasir" ? (
                          <Badge tone="info">Kasir</Badge>
                        ) : (
                          <Badge tone="neutral">Kepala Kedai</Badge>
                        )}
                      </TD>
                      <TD>
                        {item.is_active ? (
                          <Badge tone="success">Aktif</Badge>
                        ) : (
                          <Badge tone="neutral">Nonaktif</Badge>
                        )}
                      </TD>
                      <TD>
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/karyawan/${item.id}`}
                            className="inline-flex h-9 items-center gap-2 border-2 border-ink bg-surface px-3 font-display text-xs font-bold uppercase tracking-tight text-ink shadow-brutal-sm press-brutal hover:bg-primary-light"
                          >
                            <QrCode className="size-4" aria-hidden />
                            Kartu QR
                          </Link>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openUbah(item)}
                            aria-label={`Ubah ${item.name}`}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Ubah
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => setResetTarget(item)}
                            aria-label={`Terbitkan kartu QR baru untuk ${item.name}`}
                          >
                            <KeyRound className="size-4" aria-hidden />
                            Kartu Baru
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => toggleAktif(item)}
                            aria-label={`${item.is_active ? "Nonaktifkan" : "Aktifkan"} ${item.name}`}
                          >
                            <Power className="size-4" aria-hidden />
                            {item.is_active ? "Nonaktifkan" : "Aktifkan"}
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
        Karyawan tidak bisa dihapus — hanya dinonaktifkan. Transaksi, shift, dan
        absensi yang sudah terjadi tetap merujuk karyawan ini.
      </p>

      {/* key memaksa form dibuat ulang saat berganti target, supaya
          defaultValue ikut berubah. */}
      <KaryawanForm
        key={editing?.id ?? "baru"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        karyawan={editing}
        daftarKedai={daftarKedai}
      />

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(undefined)}
        title="Terbitkan kartu QR baru?"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setResetTarget(undefined)}
              disabled={pending}
            >
              Batal
            </Button>
            <Button variant="danger" onClick={konfirmasiReset} disabled={pending}>
              {pending ? "Menerbitkan..." : "Terbitkan Kartu Baru"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Kartu QR{" "}
          <span className="font-semibold text-ink">
            {resetTarget?.name}
          </span>{" "}
          sekarang akan berhenti berlaku, lalu token baru dicetak lewat halaman
          kartu. Lakukan ini kalau kartu hilang atau ragu telah disalin orang
          lain.
        </p>
      </Modal>
    </div>
  );
}