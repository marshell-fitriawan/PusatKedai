import { Card, CardDescription, CardHeader, CardTitle } from "./card";

/**
 * Penanda halaman yang layoutnya sudah jadi tapi isinya belum dibangun.
 *
 * Sengaja tidak menampilkan data contoh yang terlihat asli -- di aplikasi
 * kasir, angka palsu yang tampak nyata lebih berbahaya daripada halaman
 * kosong yang jujur.
 */
export function PagePlaceholder({
  title,
  task,
  description,
}: {
  title: string;
  /** ID task di docs/Tasks.md yang akan mengisi halaman ini. */
  task: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Belum dibangun</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <p className="text-sm text-text-secondary">
          Dikerjakan di task{" "}
          <code className="border-2 border-ink bg-primary px-1 py-0.5 text-xs font-bold">
            {task}
          </code>{" "}
          — lihat docs/Tasks.md.
        </p>
      </Card>
    </div>
  );
}
