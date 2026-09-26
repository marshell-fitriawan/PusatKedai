"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import {
  hapusPengeluaran,
  tambahPengeluaran,
} from "@/app/admin/(dashboard)/pengeluaran/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatUang } from "@/lib/utils";

const kategoriOptions = [
  { value: "bahan_baku", label: "Bahan Baku" },
  { value: "listrik", label: "Listrik" },
  { value: "sewa", label: "Sewa" },
  { value: "gaji", label: "Gaji" },
  { value: "lainnya", label: "Lainnya" },
] as const;

const labelKategori: Record<string, string> = Object.fromEntries(
  kategoriOptions.map((k) => [k.value, k.label]),
);

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export type BarisPengeluaran = {
  id: string;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  kedai: { name: string } | null;
  from_cash: boolean | null;
  shift: { business_date: string } | null;
};

export type ShiftTerbuka = {
  id: string;
  kedai_id: string;
  business_date: string;
  kedai: { name: string } | null;
};

export function PengeluaranList({
  daftarKedai,
  daftarShiftTerbuka,
  kedaiTerpilih,
  dari,
  sampai,
  baris,
  total,
}: {
  daftarKedai: { id: string; name: string }[];
  daftarShiftTerbuka: ShiftTerbuka[];
  kedaiTerpilih: string;
  dari: string;
  sampai: string;
  baris: BarisPengeluaran[];
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kedai, setKedai] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [fromCash, setFromCash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [hapus, setHapus] = useState<BarisPengeluaran | null>(null);

  const shiftKedai = daftarShiftTerbuka.filter((s) => s.kedai_id === kedai);

  function bukaForm() {
    setKedai(kedaiTerpilih || "");
    setCategory("");
    setDescription("");
    setAmount("");
    setExpenseDate(new Date().toISOString().slice(0, 10));
    setShiftId("");
    setFromCash(false);
    setError(null);
    setOpen(true);
  }

  function pilihKedai(id: string) {
    setKedai(id);
    setShiftId("");
    setFromCash(false);
  }

  function simpan() {
    setError(null);
    startTransition(async () => {
      const res = await tambahPengeluaran(
        kedai,
        category as (typeof kategoriOptions)[number]["value"],
        description,
        Number(amount),
        expenseDate,
        shiftId,
        fromCash,
      );
      if (res.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function hapusBaris() {
    if (!hapus) return;
    setError(null);
    startTransition(async () => {
      const res = await hapusPengeluaran(hapus.id);
      if (res.error) {
        setError(res.error);
        return;
      }
      setHapus(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pengeluaran</h1>
          <p className="text-sm text-text-secondary">
            Biaya operasional per kedai · total filter:{" "}
            <span className="font-bold tabular-nums">{formatUang(total)}</span>
          </p>
        </div>
        <Button onClick={bukaForm} aria-label="Catat pengeluaran baru">
          <Plus className="size-4" aria-hidden />
          Catat Biaya
        </Button>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <Select
            name="kedai"
            label="Kedai"
            defaultValue={kedaiTerpilih}
            options={[
              { value: "", label: "Semua kedai" },
              ...daftarKedai.map((k) => ({ value: k.id, label: k.name })),
            ]}
          />
        </div>
        <div className="min-w-40">
          <Input label="Dari tanggal" name="dari" type="date" defaultValue={dari} />
        </div>
        <div className="min-w-40">
          <Input label="Sampai tanggal" name="sampai" type="date" defaultValue={sampai} />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 items-center gap-2 border-2 border-ink bg-primary px-5 font-display text-sm font-bold uppercase tracking-tight text-ink shadow-brutal press-brutal"
        >
          Saring
        </button>
      </form>

      {baris.length === 0 ? (
        <Card className="text-center">
          <p className="text-sm text-text-secondary">
            Tidak ada pengeluaran untuk filter ini.
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile: kartu bertumpuk */}
          <div className="flex flex-col gap-3 lg:hidden">
            {baris.map((b) => (
              <Card key={b.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{b.kedai?.name ?? "—"}</p>
                    <p className="text-xs text-text-secondary">
                      {tanggal.format(new Date(`${b.expense_date}T00:00:00`))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge tone="neutral">{labelKategori[b.category] ?? b.category}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Hapus pengeluaran ${b.description}`}
                      onClick={() => setHapus(b)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
                <p className="break-words text-sm">{b.description}</p>
                <div className="flex items-center justify-between gap-2 border-t-2 border-ink pt-2">
                  {b.from_cash ? (
                    <Badge tone="warning">
                      Dari kas{b.shift?.business_date ? ` · ${b.shift.business_date}` : ""}
                    </Badge>
                  ) : (
                    <span className="text-xs text-text-disabled">Dari luar kas</span>
                  )}
                  <p className="text-base font-bold tabular-nums">
                    {formatUang(Number(b.amount))}
                  </p>
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
                    <TH>Kedai</TH>
                    <TH>Tanggal</TH>
                    <TH>Kategori</TH>
                    <TH>Deskripsi</TH>
                    <TH>Sumber</TH>
                    <TH numeric>Jumlah</TH>
                    <TH>Aksi</TH>
                  </TR>
                </THead>
                <TBody>
                  {baris.map((b) => (
                    <TR key={b.id}>
                      <TD className="font-semibold">{b.kedai?.name ?? "—"}</TD>
                      <TD className="text-text-secondary">
                        {tanggal.format(new Date(`${b.expense_date}T00:00:00`))}
                      </TD>
                      <TD>
                        <Badge tone="neutral">{labelKategori[b.category] ?? b.category}</Badge>
                      </TD>
                      <TD className="max-w-56 truncate text-text-secondary" title={b.description}>
                        {b.description}
                      </TD>
                      <TD>
                        {b.from_cash ? (
                          <>
                            <Badge tone="warning">Dari kas</Badge>
                            {b.shift?.business_date ? (
                              <span className="ml-2 text-xs text-text-secondary">
                                pada {b.shift.business_date}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-text-disabled">—</span>
                        )}
                      </TD>
                      <TD numeric>{formatUang(Number(b.amount))}</TD>
                      <TD>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Hapus pengeluaran ${b.description}`}
                          onClick={() => setHapus(b)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
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
        Kategori dibatasi daftar tetap (bahan baku, listrik, sewa, gaji,
        lainnya). Pencatat selalu admin pusat yang sedang masuk. Kalau uang
        keluar dari laci kas saat bekerja, centang &quot;Diambil dari laci
        kas&quot; lalu pilih jam kerjanya — pengeluaran itu otomatis dikurangi
        dari hitungan kas saat penutupan. Catatan yang salah cukup dihapus —
        tidak memengaruhi catatan lain.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Catat Pengeluaran"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="secondary" disabled={pending} onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              disabled={
                pending ||
                !kedai ||
                !category ||
                description.trim().length < 3 ||
                !amount ||
                !expenseDate ||
                (fromCash && !shiftId)
              }
              onClick={simpan}
            >
              {pending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Select
            label="Kedai"
            value={kedai}
            onChange={(e) => pilihKedai(e.target.value)}
            options={daftarKedai.map((k) => ({ value: k.id, label: k.name }))}
          />
          <Select
            label="Kategori"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[...kategoriOptions]}
          />
          <Input
            label="Deskripsi"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beli gula & susu untuk minggu ini"
          />
          <Input
            label="Jumlah (RM)"
            numeric
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
          <Input
            label="Tanggal"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
          <Select
            label="Jam kerja (saat uang itu keluar)"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            options={[
              { value: "", label: "Pilih jam kerja..." },
              ...shiftKedai.map((s) => ({
                value: s.id,
                label: `${s.kedai?.name ?? "Kedai"} · ${s.business_date} (sedang buka)`,
              })),
            ]}
          />
          <label
            className={`flex items-center gap-2 border-2 border-ink p-3 text-sm ${
              shiftKedai.length > 0 ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            }`}
          >
            <input
              type="checkbox"
              checked={fromCash}
              disabled={shiftKedai.length === 0}
              onChange={(e) => {
                setFromCash(e.target.checked);
                if (!e.target.checked) setShiftId("");
              }}
              className="size-4 accent-primary"
            />
            <span className="flex-1">
              <span className="block font-semibold">Diambil dari laci kas</span>
              <span className="block text-xs text-text-secondary">
                {shiftKedai.length === 0
                  ? "Kedai ini tidak sedang buka — tidak bisa dicatat sebagai uang dari laci kas."
                  : "Mengurangi hitungan kas penutupan hari itu."}
              </span>
            </span>
          </label>

          {fromCash ? (
            <p className="border-2 border-ink bg-warning p-3 text-xs font-semibold text-ink">
              Uang keluar dari laci kas pada jam kerja itu → selisih penutupan
              akan naik sebesar jumlah ini.
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

      <Modal
        open={hapus !== null}
        onClose={() => setHapus(null)}
        title="Hapus Pengeluaran?"
        footer={
          <div className="flex w-full justify-end gap-3">
            <Button variant="secondary" disabled={pending} onClick={() => setHapus(null)}>
              Batal
            </Button>
            <Button variant="danger" disabled={pending} onClick={hapusBaris}>
              {pending ? "Menghapus..." : "Hapus"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">
          “{hapus?.description ?? ""}” sebesar{" "}
          <span className="font-semibold tabular-nums">
            {hapus ? formatUang(Number(hapus.amount)) : ""}
          </span>{" "}
          akan dihapus permanen.
        </p>
      </Modal>
    </div>
  );
}