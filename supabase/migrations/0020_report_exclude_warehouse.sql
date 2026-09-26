-- =====================================================================
-- 0020: laporan penjualan tidak menyertakan gudang pusat
--
-- Gudang pusat (kedai.is_warehouse = true) bukan gerai penjualan: tidak punya
-- karyawan, tidak buka sesi, tidak menerima transaksi kasir. Karena
-- report_harian & report_laba_rugi sengaja memakai `from kedai` supaya kedai
-- tanpa transaksi tetap muncul (omzet 0), gudang ikut tampil sebagai baris
-- omzet 0 -- derau yang menyesatkan pemilik.
--
-- Aturan:
--   report_harian     -> gudang selalu dikecualikan (tidak pernah ada transaksi).
--   report_laba_rugi  -> gudang dikecualikan KECUALI punya pengeluaran pada
--                        rentang, agar biaya yang tercatat di gudang tidak
--                        hilang diam-diam dari total.
--
-- Laporan STOK sengaja TIDAK diubah: gudang memang menyimpan stok jadi &
-- bahan mentah, jadi kolom gudang tetap relevan di sana.
--
-- Hanya definisi fungsi yang berubah -- tidak ada kolom/tabel baru, sehingga
-- lib/database.types.ts tidak terpengaruh.
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
  where k.is_warehouse = false
  order by d.tanggal, k.name;
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
  where k.is_warehouse = false
     or exists (
       select 1
       from expenses e
       where e.kedai_id = k.id
         and e.expense_date between p_dari and p_sampai
     )
  order by k.name;
$$;

revoke all on function public.report_harian(date, date)
  from public, anon, authenticated;
revoke all on function public.report_laba_rugi(date, date)
  from public, anon, authenticated;

grant execute on function public.report_harian(date, date) to authenticated;
grant execute on function public.report_laba_rugi(date, date) to authenticated;
