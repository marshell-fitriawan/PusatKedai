-- =====================================================================
-- 0017: laporan ringkasan harian + rasio void per karyawan (M8-4)
--
-- report_harian(dari, sampai):
--    Rangkaian tanggal × kedai (kedai tanpa transaksi tetap muncul, omzet 0).
--    Per (tanggal, kedai): omzet & jumlah transaksi (status completed, void
--    dan perlu_review dikecualikan), jumlah batalkan (void), jumlah menunggu
--    review (perlu_review), dan jumlah sesi yang selisihnya masih `terbuka`.
--
-- report_void_karyawan(dari, sampai):
--    Rasio pembatalan per karyawan. Denominator = semua transaksi karyawan
--    (completed + void); numerator = transaksi berstatus void (perlu review
--    yang belum diputuskan tidak dihitung). Hanya karyawan yang MEMILIKI void
--    yang muncul -- justru itu yang harus diwaspadai pemilik.
--
-- Keduanya ditulis setelah pola report_omzet/laba_rugi (0010): dihitung di
-- DB, satu definisi angka di semua halaman. Hak sama dengan laporan lain
-- (0011): anon ditolak, authenticated diizinkan.
-- =====================================================================

create or replace function public.report_harian(
  p_dari   date,
  p_sampai date
)
returns table (
  tanggal            date,
  kedai_id           uuid,
  kedai              text,
  omzet              numeric,
  jumlah_transaksi   integer,
  jumlah_void        integer,
  jumlah_perlu_review integer,
  selisih_terbuka    integer
)
language sql
stable
as $$
  select
    d.tanggal,
    k.id                as kedai_id,
    k.name              as kedai,
    coalesce(om.omzet, 0)          as omzet,
    coalesce(om.jumlah_transaksi, 0) as jumlah_transaksi,
    coalesce(vo.jumlah_void, 0)    as jumlah_void,
    coalesce(pr.tertunda, 0)       as jumlah_perlu_review,
    coalesce(st.selisih_terbuka, 0) as selisih_terbuka
  from kedai k
  cross join generate_series(p_dari, p_sampai, '1 day') as d(tanggal)
  left join (
    select kedai_id, business_date, sum(total) as omzet, count(*)::int as jumlah_transaksi
    from transactions
    where status = 'completed' and business_date between p_dari and p_sampai
    group by kedai_id, business_date
  ) om on om.kedai_id = k.id and om.business_date = d.tanggal
  left join (
    select kedai_id, business_date, count(*)::int as jumlah_void
    from transactions
    where status = 'void' and business_date between p_dari and p_sampai
    group by kedai_id, business_date
  ) vo on vo.kedai_id = k.id and vo.business_date = d.tanggal
  left join (
    select kedai_id, business_date, count(*)::int as tertunda
    from transactions
    where status = 'perlu_review' and business_date between p_dari and p_sampai
    group by kedai_id, business_date
  ) pr on pr.kedai_id = k.id and pr.business_date = d.tanggal
  left join (
    select kedai_id, business_date, count(*)::int as selisih_terbuka
    from shifts
    where reconciliation_status = 'final'
      and difference_status = 'terbuka'
      and business_date between p_dari and p_sampai
    group by kedai_id, business_date
  ) st on st.kedai_id = k.id and st.business_date = d.tanggal
  order by d.tanggal, k.name;
$$;

create or replace function public.report_void_karyawan(
  p_dari   date,
  p_sampai date
)
returns table (
  kedai_id        uuid,
  kedai           text,
  employee_id     uuid,
  employee        text,
  total_transaksi integer,
  jumlah_void     integer,
  rasio_persen    numeric
)
language sql
stable
as $$
  select
    t.kedai_id,
    k.name                                 as kedai,
    t.voided_by                            as employee_id,
    e.name                                 as employee,
    count(*) filter (where t.status in ('completed', 'void'))::int as total_transaksi,
    count(*) filter (where t.status = 'void')::int                 as jumlah_void,
    round(
      count(*) filter (where t.status = 'void')::numeric
      / nullif(count(*) filter (where t.status in ('completed', 'void'))::numeric, 0)
      * 100, 1
    )                                      as rasio_persen
  from transactions t
  join kedai k    on k.id = t.kedai_id
  join employees e on e.id = t.voided_by
  where t.business_date between p_dari and p_sampai
    and t.voided_by is not null
  group by t.kedai_id, k.name, t.voided_by, e.name
  order by rasio_persen desc nulls last, jumlah_void desc;
$$;

revoke all on function public.report_harian(date, date)
  from public, anon;
revoke all on function public.report_void_karyawan(date, date)
  from public, anon;

grant execute on function public.report_harian(date, date) to authenticated;
grant execute on function public.report_void_karyawan(date, date) to authenticated;