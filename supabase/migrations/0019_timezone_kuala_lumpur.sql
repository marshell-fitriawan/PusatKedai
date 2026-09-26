-- =====================================================================
-- 0019: zona waktu default mengikuti Malaysia
--
-- Klien pertama adalah pemilik di Malaysia. Sebelumnya default kedai
-- masih 'Asia/Jakarta'. Baris yang sudah ada (mis. hasil seed) ikut
-- dialihkan supaya business_date langsung mengikuti waktu Malaysia.
-- =====================================================================

alter table public.kedai
  alter column timezone set default 'Asia/Kuala_Lumpur';

update public.kedai
   set timezone = 'Asia/Kuala_Lumpur'
 where timezone = 'Asia/Jakarta';