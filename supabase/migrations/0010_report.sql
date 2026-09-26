-- =====================================================================
-- Fungsi laporan agregasi (M5-2)
--
-- Omzet dan untung-rugi dihitung DI DATABASE, bukan di browser:
--   1. Jumlah data menyentuh ratusan ribu baris dalam setahun; menarik semuanya
--      ke server component lalu menjumlahkan di JavaScript tidak akan pernah
--      sebanding dengan GROUP BY di Postgres.
--   2. Satu sumber definisi -- "omzet" selalu = sum(total) status completed
--      dalam rentang + granularitas yang sama di semua halaman.
--
-- report_omzet(lama, baru, granularitas):
--    granularitas 'harian' | 'mingguan' | 'bulanan'
--    -> tanggal (bucket), kedai_id, omzet, jumlah transaksi
--    Transaksi berstatus void TIDAK pernah ikut: transaksi yang dibatalkan
--    tidak menghasilkan uang, walau barisnya tetap ada di tabel.
--    Mingguan dibuka Senin (date_trunc('week') bawaan Postgres).
--
-- report_laba_rugi(lama, baru):
--    Semua kedai (termasuk yang tanpa transaksi) + omzet, pengeluaran, selisih.
--    Pengeluaran dari expenses.amount sesuai expense_date dalam rentang.
-- =====================================================================

create or replace function public.report_omzet(
  p_dari        date,
  p_sampai      date,
  p_granularity text
)
returns table (tanggal date, kedai_id uuid, omzet numeric, jumlah_transaksi integer)
language sql
stable
as $$
  select
    case
      when p_granularity = 'mingguan' then date_trunc('week', t.business_date)::date
      when p_granularity = 'bulanan'  then date_trunc('month', t.business_date)::date
      else t.business_date
    end                              as tanggal,
    t.kedai_id                        as kedai_id,
    sum(t.total)                      as omzet,
    count(*)::int                     as jumlah_transaksi
  from transactions t
  where t.status = 'completed'
    and t.business_date between p_dari and p_sampai
  group by 1, 2
  order by 1, 2;
$$;

create or replace function public.report_laba_rugi(
  p_dari   date,
  p_sampai date
)
returns table (kedai_id uuid, omzet numeric, pengeluaran numeric, selisih numeric)
language sql
stable
as $$
  select
    k.id                     as kedai_id,
    coalesce(om.omzet, 0)    as omzet,
    coalesce(bi.total, 0)    as pengeluaran,
    coalesce(om.omzet, 0) - coalesce(bi.total, 0) as selisih
  from kedai k
  left join (
    select kedai_id, sum(total) as omzet
    from transactions
    where status = 'completed' and business_date between p_dari and p_sampai
    group by kedai_id
  ) om on om.kedai_id = k.id
  left join (
    select kedai_id, sum(amount) as total
    from expenses
    where expense_date between p_dari and p_sampai
    group by kedai_id
  ) bi on bi.kedai_id = k.id
  order by k.name;
$$;

revoke all on function public.report_omzet(date, date, text)
  from public, anon, authenticated;
revoke all on function public.report_laba_rugi(date, date)
  from public, anon, authenticated;