import { redirect } from "next/navigation";

// /admin sendiri tidak punya isi -- selalu masuk ke dashboard.
export default function AdminIndex() {
  redirect("/admin/dashboard");
}
