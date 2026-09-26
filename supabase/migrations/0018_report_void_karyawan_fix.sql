-- =====================================================================
-- 0018: perbaiki rasio void per karyawan (M8-4)
--
-- 0017 menghitung rasio dengan filter `voided_by is not null`, yang keliru:
-- kumpulan itu hanya berisi baris void, jadi rasionya selalu 100%.
--
-- Basis yang benar = `employee_id` (kasir pemilik transaksi). Denominator =
-- semua transaksi kasir itu (completed + void); numerator = yang berstatus
-- void. `voided_by` tetap disimpan untuk jejak, tapi bukan penentu rasio.
-- =====================================================================

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
    t.employee_id                          as employee_id,
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
  join employees e on e.id = t.employee_id
  where t.business_date between p_dari and p_sampai
  group by t.kedai_id, k.name, t.employee_id, e.name
  having count(*) filter (where t.status = 'void') > 0
  order by rasio_persen desc nulls last, jumlah_void desc;
$$;

revoke all on function public.report_void_karyawan(date, date)
  from public, anon;
grant execute on function public.report_void_karyawan(date, date) to authenticated;