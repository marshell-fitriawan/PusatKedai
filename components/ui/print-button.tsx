"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Tombol cetak dokumen (kartu QR). Bukan server component -- butuh onClick. */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden />
      Cetak
    </Button>
  );
}