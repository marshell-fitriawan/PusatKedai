-- =====================================================================
-- 0011_report_grants.sql
--
-- Fungsi laporan sebelumnya di-revoke dari public, anon, DAN authenticated.
-- Itu benar untuk keamanan API publik, tapi melumpuhkan server app yang
-- memakai anon key + JWT sesi admin (role = authenticated saat login).
--
-- Solusi: tetap kunci anon (publik tidak boleh menyentuh omzet), tetapi
-- berikan EXECUTE ke authenticated -- satu-satunya pihak yang memanggil lewat
-- halaman terproteksi /admin. Pengujian tetap membuktikan anon ditolak.
-- =====================================================================

revoke execute on function public.report_omzet(date, date, text) from public, anon;
revoke execute on function public.report_laba_rugi(date, date) from public, anon;

grant execute on function public.report_omzet(date, date, text) to authenticated;
grant execute on function public.report_laba_rugi(date, date) to authenticated;