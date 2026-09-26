"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, DoorOpen } from "lucide-react";
import { bukaToko, type ShiftState } from "@/app/pos/(kasir)/shift/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ShiftState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth disabled={pending}>
      <DoorOpen className="size-5" aria-hidden />
      {pending ? "Membuka..." : "Buka Toko"}
    </Button>
  );
}

export function BukaTokoForm() {
  const [state, formAction] = useActionState(bukaToko, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Input
        label="Kas awal"
        name="opening_cash"
        numeric
        defaultValue="0"
        placeholder="500000"
        hint="Hitung uang fisik di laci sebelum mulai berjualan"
        required
        autoFocus
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

      <SubmitButton />
    </form>
  );
}
