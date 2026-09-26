"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import {
  createKedai,
  updateKedai,
  type FormState,
} from "@/app/admin/(dashboard)/kedai/actions";
import { TIMEZONES } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { Tables } from "@/lib/database.types";

const initialState: FormState = { error: null };

function Actions({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();

  return (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={pending}>
        Batal
      </Button>
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan..." : "Simpan"}
      </Button>
    </>
  );
}

export function KedaiForm({
  open,
  onClose,
  kedai,
}: {
  open: boolean;
  onClose: () => void;
  /** Ada = mode ubah, tidak ada = mode tambah. */
  kedai?: Tables<"kedai">;
}) {
  const action = kedai ? updateKedai.bind(null, kedai.id) : createKedai;
  const [state, formAction] = useActionState(action, initialState);

  // Modal ditutup di sini, bukan di dalam server action -- action berjalan di
  // server dan tidak tahu apa pun soal UI. Penanda `ok` dipakai supaya render
  // pertama tidak ikut memicu penutupan (initialState juga punya error null).
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kedai ? "Ubah Kedai" : "Tambah Kedai"}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Input
          label="Nama kedai"
          name="name"
          defaultValue={kedai?.name ?? ""}
          error={state.fieldErrors?.name}
          placeholder="Kedai Melati"
          required
          autoFocus
        />

        <Input
          label="Alamat"
          name="address"
          defaultValue={kedai?.address ?? ""}
          error={state.fieldErrors?.address}
          placeholder="Jl. Melati No. 12, Bandung"
        />

        <Input
          label="Telepon"
          name="phone"
          type="tel"
          defaultValue={kedai?.phone ?? ""}
          error={state.fieldErrors?.phone}
          placeholder="022-1110001"
        />

        <Select
          label="Zona waktu"
          name="timezone"
          defaultValue={kedai?.timezone ?? "Asia/Kuala_Lumpur"}
          error={state.fieldErrors?.timezone}
          options={[...TIMEZONES]}
          hint="Menentukan batas hari untuk laporan dan nomor transaksi"
        />

        <Input
          label="Ambang stok menipis"
          name="low_stock_threshold"
          numeric
          defaultValue={String(kedai?.low_stock_threshold ?? 5)}
          error={state.fieldErrors?.low_stock_threshold}
          hint="Stok di bawah angka ini ditandai kuning di halaman kasir"
        />

        {/* Checkbox gudang pusat. Satu kedai bisa menjadi sumber assign/produksi
            (docs/Database.md §10); kedai ini tidak punya karyawan maupun kasir. */}
        <label
          className="flex min-h-11 cursor-pointer items-center gap-3 border-2 border-ink px-3"
        >
          <input
            type="checkbox"
            name="is_warehouse"
            defaultChecked={kedai?.is_warehouse ?? false}
            className="size-5 accent-primary"
          />
          <span>
            <span className="block text-sm font-semibold">Gudang pusat</span>
            <span className="block text-xs text-text-secondary">
              Pusat stok dari produksi; bukan lokasi jualan, tidak ada kasir
            </span>
          </span>
        </label>

        {state.error ? (
          <p
            role="alert"
            className="flex items-start gap-2 border-2 border-ink bg-danger p-3 text-sm font-semibold text-ink"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            {state.error}
          </p>
        ) : null}

        <div className="mt-2 flex justify-end gap-3">
          <Actions onCancel={onClose} />
        </div>
      </form>
    </Modal>
  );
}
