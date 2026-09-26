"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { keCsv } from "@/lib/export/csv";

/**
 * Tombol unduh CSV. Bekerja sepenuhnya di sisi browser: server mengirim data
 * mentah, klien membungkusnya jadi Blob lalu memicu download.
 */
export function ExportCsvButton({
  filename,
  header,
  baris,
  label = "Unduh CSV",
}: {
  filename: string;
  header: string[];
  baris: (string | number | null)[][];
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  function unduh() {
    startTransition(() => {
      const csv = keCsv(header, baris);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <Button
      variant="secondary"
      size="md"
      disabled={pending || baris.length === 0}
      onClick={unduh}
    >
      <Download className="size-4" aria-hidden />
      {pending ? "Menyiapkan..." : label}
    </Button>
  );
}