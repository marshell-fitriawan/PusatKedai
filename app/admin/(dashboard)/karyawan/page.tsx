import { KaryawanList } from "@/components/admin/karyawan-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Karyawan — Admin Pusat" };

export default async function KaryawanPage() {
  const supabase = await createClient();

  const [kedaiRes, karyawanRes] = await Promise.all([
    supabase
      .from("kedai")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("employees")
      .select("id, name, role, is_active, kedai_id, kedai:kedai_id(name)")
      .order("name"),
  ]);

  const gagal = kedaiRes.error ?? karyawanRes.error;
  if (gagal) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Karyawan</h1>
        <p role="alert" className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink">
          Gagal memuat data: {gagal.message}
        </p>
      </div>
    );
  }

  return (
    <KaryawanList
      daftarKedai={kedaiRes.data ?? []}
      karyawan={(karyawanRes.data ?? []) as KaryawanItem[]}
    />
  );
}

export type KaryawanItem = {
  id: string;
  name: string;
  role: "kasir" | "admin_kedai";
  is_active: boolean;
  kedai_id: string;
  kedai: { name: string } | null;
};