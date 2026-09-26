import { redirect } from "next/navigation";

// /pos sendiri tidak punya isi -- kasir langsung ke halaman jualan.
export default function PosIndex() {
  redirect("/pos/kasir");
}
