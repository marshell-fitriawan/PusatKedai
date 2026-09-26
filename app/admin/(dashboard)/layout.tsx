import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Gerbang otorisasi sebenarnya.
 *
 * Middleware hanya memastikan ada sesi Supabase Auth; di sinilah dipastikan
 * user memang terdaftar sebagai admin aktif. Karena diletakkan di layout,
 * setiap halaman di bawah /admin ikut terlindungi tanpa perlu mengulang
 * pemeriksaan satu per satu -- pola yang gampang terlupa kalau dipasang
 * per halaman.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdmin();

  const db = createAdminClient();
  const { count } = await db
    .from("notifikasi")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  return (
    <AdminShell
      clientName={process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Multi-Kedai"}
      adminName={admin.name}
      adminRole={admin.role}
      notifCount={count ?? 0}
    >
      {children}
    </AdminShell>
  );
}
