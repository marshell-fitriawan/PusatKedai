import { KedaiList } from "@/components/admin/kedai-list";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Kedai — Admin Pusat",
};

export default async function KedaiPage() {
  // Client server memakai anon key + sesi user, jadi query ini tetap lewat
  // RLS. Kalau suatu saat mengembalikan kosong padahal data ada, penyebabnya
  // hampir pasti otorisasi -- bukan query-nya.
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kedai")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Kedai</h1>
        <p
          role="alert"
          className="border-2 border-ink bg-danger p-4 text-sm font-semibold text-ink"
        >
          Gagal memuat daftar kedai: {error.message}
        </p>
      </div>
    );
  }

  return <KedaiList data={data ?? []} />;
}
