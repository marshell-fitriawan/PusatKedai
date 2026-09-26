"use client";

import { useState } from "react";
import { Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatUang } from "@/lib/utils";

/**
 * Halaman preview komponen (M0-12).
 * Dipakai sebagai acuan saat audit UI di M6-1 -- bukan bagian dari aplikasi.
 */

const colors = [
  ["primary", "bg-primary"],
  ["primary-dark", "bg-primary-dark"],
  ["primary-light", "bg-primary-light"],
  ["accent-blue", "bg-accent-blue"],
  ["accent-blue-light", "bg-accent-blue-light"],
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["surface-alt", "bg-surface-alt"],
  ["ink", "bg-ink"],
  ["text-secondary", "bg-text-secondary"],
  ["text-disabled", "bg-text-disabled"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
  ["success-text", "bg-success-text"],
  ["warning-text", "bg-warning-text"],
  ["danger-text", "bg-danger-text"],
  ["info-text", "bg-info-text"],
] as const;

const rows = [
  { kedai: "Kedai Melati", omzet: 4_250_000, tx: 132, status: "final" },
  { kedai: "Kedai Kenanga", omzet: 3_180_000, tx: 98, status: "pending" },
  { kedai: "Kedai Cempaka", omzet: 5_940_000, tx: 176, status: "final" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function DevUiPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Preview Komponen</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Acuan visual dari docs/design_1.md (Neo-Brutalism, tema putih/kuning).
          Kalau ada komponen di aplikasi yang menyimpang dari halaman ini, yang
          salah komponennya.
        </p>
      </header>

      <Section title="Warna">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {colors.map(([name, bg]) => (
            <div key={name} className="flex items-center gap-3">
              <span className={`size-10 shrink-0 border-2 border-ink ${bg}`} />
              <code className="text-xs text-text-secondary">{name}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografi">
        <Card className="flex flex-col gap-2">
          <p className="text-2xl font-bold">2xl — Heading halaman</p>
          <p className="text-xl font-bold">xl — Heading section</p>
          <p className="text-lg font-bold">lg — Harga di POS</p>
          <p className="text-base">base — Body utama</p>
          <p className="text-sm text-text-secondary">sm — Teks tabel</p>
          <p className="text-xs text-text-secondary">xs — Caption</p>
          <p className="text-3xl font-bold tabular-nums">
            {formatUang(1234567)} · 3xl — angka besar
          </p>
          <p className="text-lg font-bold tabular-nums">
            {formatUang(1234567)} · angka pakai tabular figures
          </p>
        </Card>
      </Section>

      <Section title="Tombol">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Simpan</Button>
            <Button variant="secondary">Batal</Button>
            <Button variant="ghost">Lewati</Button>
            <Button variant="danger">Void transaksi</Button>
            <Button disabled>Nonaktif</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">sm (36px, admin saja)</Button>
            <Button size="md">md (44px)</Button>
            <Button size="lg">lg (48px)</Button>
          </div>
          <Button fullWidth size="lg">
            Bayar — {formatUang(85000)}
          </Button>
        </Card>
      </Section>

      <Section title="Input">
        <Card className="flex flex-col gap-4">
          <Input label="Nama produk" placeholder="Es Kopi Susu" />
          <Input
            label="Kas awal"
            numeric
            defaultValue="500000"
            hint="Dihitung fisik sebelum toko buka"
          />
          <Input
            label="Jumlah mutasi"
            numeric
            defaultValue="120"
            error="Melebihi stok kedai asal (tersedia 80)"
          />
          <Input label="Kode kedai" defaultValue="KDI-001" disabled />
        </Card>
      </Section>

      <Section title="Status Badge">
        <Card className="flex flex-wrap gap-3">
          <Badge tone="success">Tersimpan</Badge>
          <Badge tone="warning">Belum sync</Badge>
          <Badge tone="danger">Stok minus</Badge>
          <Badge tone="info">Menunggu approval</Badge>
          <Badge>Draf</Badge>
        </Card>
      </Section>

      <Section title="Card">
        <Card>
          <CardHeader>
            <CardTitle>Kedai Melati</CardTitle>
            <CardDescription>Shift dibuka 07:12 oleh Rina</CardDescription>
          </CardHeader>
          <p className="text-3xl font-bold tabular-nums">{formatUang(4250000)}</p>
        </Card>
      </Section>

      <Section title="Peringatan (blok status)">
        <div className="flex flex-col gap-3">
          <p className="border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink">
            Stok kedai asal kurang dari jumlah yang diminta.
          </p>
          <p className="border-2 border-ink bg-warning p-3 text-sm font-semibold text-ink">
            Shift belum ditutup — masih ada transaksi di antrian.
          </p>
          <p className="border-2 border-ink bg-success p-3 text-sm font-semibold text-ink">
            Selisih kas nol. Shift siap ditutup.
          </p>
          <p className="border-2 border-ink bg-info p-3 text-sm font-semibold text-white">
            Sinkronisasi berjalan di latar belakang.
          </p>
        </div>
      </Section>

      <Section title="Empty state">
        <div className="flex flex-col items-center gap-3 border-2 border-dashed border-ink p-8 text-center">
          <span className="flex size-12 items-center justify-center border-2 border-ink bg-primary-light text-ink">
            <Inbox className="size-6" aria-hidden />
          </span>
          <p className="text-sm text-text-secondary">Belum ada data.</p>
        </div>
      </Section>

      <Section title="Tabel Laporan">
        <Card className="p-0">
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Kedai</TH>
                  <TH numeric>Omzet</TH>
                  <TH numeric>Transaksi</TH>
                  <TH>Rekonsiliasi</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.kedai}>
                    <TD>{row.kedai}</TD>
                    <TD numeric>{formatUang(row.omzet)}</TD>
                    <TD numeric>{row.tx}</TD>
                    <TD>
                      {row.status === "final" ? (
                        <Badge tone="success">Final</Badge>
                      ) : (
                        <Badge tone="warning">Belum final</Badge>
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </Card>
      </Section>

      <Section title="Modal / Bottom Sheet">
        <Card>
          <Button onClick={() => setModalOpen(true)}>Buka contoh</Button>
          <p className="mt-3 text-sm text-text-secondary">
            Bottom sheet di HP, modal tengah di layar lebar. Esc dan klik
            backdrop menutup.
          </p>
        </Card>

        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Tutup toko"
          footer={
            <>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Batal
              </Button>
              <Button onClick={() => setModalOpen(false)}>Tutup shift</Button>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Input label="Kas fisik akhir" numeric defaultValue="1750000" />
            <p className="text-sm text-text-secondary">
              Masih ada 3 transaksi di antrian. Selisih kas dihitung ulang
              otomatis setelah semuanya terkirim.
            </p>
            <Badge tone="warning">Belum final</Badge>
          </div>
        </Modal>
      </Section>
    </main>
  );
}
