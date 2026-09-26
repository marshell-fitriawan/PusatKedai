-- ============================================================
-- 0016: kas keluar harus mengikat ke sesi (melengkapi 0015)
--
-- `expenses.from_cash = true` berarti uang keluar dari laci kas saat
-- sebuah sesi bekerja. Tanpa shift_id, pengeluaran itu tidak akan pernah
-- dikurangi dari expected_cash sesi mana pun -- uang hilang dari laci
-- tanpa tercatat selisihnya. Invariant: dari kas wajib tahu sesinya.
-- ============================================================

alter table public.expenses
  add constraint expenses_from_cash_requires_shift
  check (not from_cash or shift_id is not null);

comment on constraint expenses_from_cash_requires_shift on public.expenses is
  'Pengeluaran yang "ambil dari kas" harus mengikat ke sebuah sesi, agar reconcile_shift bisa menguranginya dari kas seharusnya.';