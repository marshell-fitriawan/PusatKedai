"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import {
  createKaryawan,
  updateKaryawan,
  type FormState,
} from "@/app/admin/(dashboard)/karyawan/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

const initialState: FormState = { error: null };

const ROLE_OPTIONS = [
  { value: "kasir", label: "Kasir" },
  { value: "admin_kedai", label: "Kepala Kedai" },
];

type Item = {
  id: string;
  name: string;
  role: "kasir" | "admin_kedai";
  kedai_id: string;
};

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

export function KaryawanForm({
  open,
  onClose,
  karyawan,
  daftarKedai,
}: {
  open: boolean;
  onClose: () => void;
  /** Ada = mode ubah, tidak ada = mode tambah. */
  karyawan?: Item;
  daftarKedai: { id: string; name: string }[];
}) {
  const action = karyawan ? updateKaryawan.bind(null, karyawan.id) : createKaryawan;
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={karyawan ? "Ubah Karyawan" : "Tambah Karyawan"}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Input
          label="Nama karyawan"
          name="name"
          defaultValue={karyawan?.name ?? ""}
          error={state.fieldErrors?.name}
          placeholder="Rina Kasir"
          required
          autoFocus
        />

        <Select
          label="Kedai"
          name="kedai_id"
          defaultValue={karyawan?.kedai_id ?? ""}
          error={state.fieldErrors?.kedai_id}
          options={daftarKedai.map((k) => ({ value: k.id, label: k.name }))}
          hint="Kartu QR karyawan hanya berlaku untuk kedai ini"
        />

        <Select
          label="Peran"
          name="role"
          defaultValue={karyawan?.role ?? "kasir"}
          error={state.fieldErrors?.role}
          options={[...ROLE_OPTIONS]}
          hint="Kasir = bertransaksi; Kepala Kedai = bisa membuka dan menutup toko"
        />

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