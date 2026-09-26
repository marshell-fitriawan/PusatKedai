"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { ImageOff, Pencil, Plus, Power } from "lucide-react";
import { setProdukActive } from "@/app/admin/(dashboard)/produk/actions";
import { ProdukForm } from "@/components/admin/produk-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatUang } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

type Produk = Tables<"products">;

export function ProdukList({ data }: { data: Produk[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Produk | undefined>();
  const [pending, startTransition] = useTransition();

  const kategoriTersedia = useMemo(
    () =>
      [...new Set(data.map((p) => p.category).filter((c): c is string => !!c))].sort(),
    [data],
  );

  const jumlahAktif = data.filter((p) => p.is_active).length;

  function openTambah() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openUbah(produk: Produk) {
    setEditing(produk);
    setFormOpen(true);
  }

  function toggleAktif(produk: Produk) {
    startTransition(async () => {
      await setProdukActive(produk.id, !produk.is_active);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Produk</h1>
          <p className="text-sm text-text-secondary">
            {jumlahAktif} aktif dari {data.length} produk
          </p>
        </div>

        <Button onClick={openTambah}>
          <Plus className="size-4" aria-hidden />
          Tambah Produk
        </Button>
      </div>

      {data.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Belum ada produk. Tambahkan menu pertama supaya kasir bisa mulai
            berjualan.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu bertumpuk */}
          <div className="flex flex-col gap-3 lg:hidden">
            {data.map((produk) => (
              <Card key={produk.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{produk.name}</p>
                    <p className="text-xs text-text-secondary">
                      {produk.category ?? "Tanpa kategori"}
                    </p>
                  </div>
                  <span className="shrink-0">
                    {produk.is_active ? (
                      <Badge tone="success">Aktif</Badge>
                    ) : (
                      <Badge tone="neutral">Nonaktif</Badge>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 border-2 border-ink bg-surface-alt p-2">
                  {produk.image_url ? (
                    <Image
                      src={produk.image_url}
                      alt=""
                      width={40}
                      height={40}
                      className="size-10 border-2 border-ink object-cover"
                    />
                  ) : (
                    <span
                      className="flex size-10 items-center justify-center border-2 border-ink bg-surface"
                      aria-label="Tanpa gambar"
                    >
                      <ImageOff className="size-4 text-text-disabled" aria-hidden />
                    </span>
                  )}
                  <p className="text-lg font-bold tabular-nums">
                    {formatUang(produk.price)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 border-t-2 border-ink pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openUbah(produk)}
                    aria-label={`Ubah ${produk.name}`}
                  >
                    <Pencil className="size-4" aria-hidden />
                    Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => toggleAktif(produk)}
                    aria-label={`${produk.is_active ? "Nonaktifkan" : "Aktifkan"} ${produk.name}`}
                  >
                    <Power className="size-4" aria-hidden />
                    {produk.is_active ? "Nonaktifkan" : "Aktifkan"}
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
                    <TH>Gambar</TH>
                    <TH>Nama</TH>
                    <TH>Kategori</TH>
                    <TH numeric>Harga</TH>
                    <TH>Status</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.map((produk) => (
                    <TR key={produk.id}>
                      <TD>
                        {produk.image_url ? (
                          <Image
                            src={produk.image_url}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 border-2 border-ink object-cover"
                          />
                        ) : (
                          <span
                            className="flex size-10 items-center justify-center border-2 border-ink bg-surface-alt"
                            aria-label="Tanpa gambar"
                          >
                            <ImageOff
                              className="size-4 text-text-disabled"
                              aria-hidden
                            />
                          </span>
                        )}
                      </TD>
                      <TD className="font-semibold">{produk.name}</TD>
                      <TD className="text-text-secondary">
                        {produk.category ?? "—"}
                      </TD>
                      <TD numeric>{formatUang(produk.price)}</TD>
                      <TD>
                        {produk.is_active ? (
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
                            onClick={() => openUbah(produk)}
                            aria-label={`Ubah ${produk.name}`}
                          >
                            <Pencil className="size-4" aria-hidden />
                            Ubah
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => toggleAktif(produk)}
                            aria-label={`${produk.is_active ? "Nonaktifkan" : "Aktifkan"} ${produk.name}`}
                          >
                            <Power className="size-4" aria-hidden />
                            {produk.is_active ? "Nonaktifkan" : "Aktifkan"}
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
        Katalog produk dipakai bersama seluruh kedai — hanya stoknya yang per
        kedai. Produk tidak bisa dihapus, hanya dinonaktifkan: produk nonaktif
        hilang dari layar kasir, tapi riwayat penjualannya tetap utuh.
      </p>

      <ProdukForm
        key={editing?.id ?? "baru"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        produk={editing}
        kategoriTersedia={kategoriTersedia}
      />
    </div>
  );
}
