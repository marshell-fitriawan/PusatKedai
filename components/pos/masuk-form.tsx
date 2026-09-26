"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";
import { mulaiSesi, type SesiState } from "@/app/pos/actions";
import { QrScanner } from "@/components/pos/qr-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: SesiState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" fullWidth disabled={pending}>
      {pending ? "Memeriksa kartu..." : "Mulai Sesi"}
    </Button>
  );
}

export function MasukForm() {
  const [state, formAction] = useActionState(mulaiSesi, initialState);
  const [token, setToken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <QrScanner
        onScan={(text) => {
          setToken(text);
          // Kasir bekerja cepat dan tangannya sering penuh. Setelah kartu
          // terbaca, sesi langsung dimulai tanpa menekan tombol lagi.
          requestAnimationFrame(() => formRef.current?.requestSubmit());
        }}
      />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-text-secondary">atau ketik manual</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Input
        label="Kode kartu"
        name="qr_token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="DEV-QR-..."
        autoComplete="off"
        hint="Cadangan kalau kamera bermasalah atau kartu tidak terbaca"
        required
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
