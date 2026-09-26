"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import {
  createBahan,
  updateBahan,
  type FormState,
} from "@/app/admin/(dashboard)/bahan/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

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

export type BarisBahan = {
  id: string;
  name: string;
  satuan: string;
  harga_beli: number | null;
};

export function BahanForm({
  open,
  onClose,
  bahan,
}: {
  open: boolean;
  onClose: () => void;
  bahan?: BarisBahan;
}) {
  const action = bahan ? updateBahan.bind(null, bahan.id) : createBahan;
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bahan ? "Ubah Bahan" : "Tambah Bahan"}
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Input
          label="Nama bahan"
          name="name"
          defaultValue={bahan?.name ?? ""}
          error={state.fieldErrors?.name}
          placeholder="Gula Pasir"
          required
          autoFocus
        />

        <Input
          label="Satuan"
          name="satuan"
          defaultValue={bahan?.satuan ?? ""}
          error={state.fieldErrors?.satuan}
          placeholder="kg, gram, bungkus, porsi"
          hint="Bebas (teks), tanpa konversi antar satuan"
          required
        />

        <Input
          label="Harga beli per satuan (opsional)"
          name="harga_beli"
          numeric
          defaultValue={
            bahan?.harga_beli != null ? String(bahan.harga_beli) : ""
          }
          error={state.fieldErrors?.harga_beli}
          placeholder="Walau opsional, diisi untuk modal per porsi nanti"
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