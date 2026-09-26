<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sistem Multi-Kedai (POS multi-cabang, offline-first)

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth) · Dexie.js (offline queue) · Midtrans QRIS.

## Read first

- `docs/panduan/README.md` → then `docs/panduan/00`→`06` before touching code. These explain *why* existing code is built the way it is.
- Design source of truth is `docs/Database.md` and `docs/design_1.md` (they win over `docs/panduan/` on conflict). `docs/Tasks.md` lists what's next.
- Docs and code comments are written in **Indonesian** — keep new ones that way.

## Commands

```bash
npm run dev            # dev server
npm run lint           # eslint (flat config, eslint.config.mjs)
npm run build          # production build (also type-checks)
npm run db -- <file.sql>            # run SQL vs live DB (e.g. npm run db -- -e "select 1")
npm run db -- supabase/tests/constraints.sql   # DB invariant tests (transactional, rollback)
npm run seed [-- --force]          # reset + seed dev data (TRUNCATE! refuses if transactions has rows)
npm run gen:types      # regenerate lib/database.types.ts from live schema
npm run icons          # regenerate PWA icons from app/icon.svg
```

- **No unit test framework** (no jest/vitest). Verification is `npm run db -- supabase/tests/*.sql` against the real DB. No `typecheck` script — `strict` TS is checked via `npm run build`.
- DB scripts load env via `--env-file=.env.local` — values must be in `.env.local`, not the shell. They need `SUPABASE_DB_URL` (pg direct, TLS with `rejectUnauthorized: false`); runtime app does not use that var.

## Database workflow

- Migrations are SQL files in `supabase/migrations/`, applied in filename order:
  `npx supabase db push --db-url "$SUPABASE_DB_URL"`. **Never edit an applied migration** — create a new one.
- **Run `npm run gen:types` after every migration**; TS types don't update themselves (hand-rolled generator bypasses `supabase gen types`, which needs Docker).
- Schema uses `text + CHECK` constraints, not Postgres ENUMs; `gen:types` turns those CHECK lists into string unions.
- Dev admin logins (both via `/admin/login`): owner `owner@kedaidev.test` / `dev-owner-2026`; admin pusat `admin@kedaidev.test` / `dev-admin-2026`. Seed creates both (`scripts/seed.mjs` + `supabase/seed.sql`).

## Git

- **Commit hanya kalau diminta.** Setelah selesai satu task, laporkan dan tunggu instruksi.
- **Jangan pernah menulis trailer `Co-Authored-By:` / `Signed-off-by:`**, dan jangan menambahkan footer atribusi AI (`Generated with …`, nama tool, atau email bot). Author harus tetap identitas developer.
- Satu fitur = satu commit. Jangan menggabungkan fitur berbeda dalam satu commit, dan jangan menyertakan file tak terkait karena "sudah terstaging" (kecuali lockfile atau hasil `gen:types` yang memang menyertainya).
- **Jangan merekonstruksi riwayat.** Kalau history sudah hilang, jadikan state saat ini satu commit baseline yang jujur — jangan memecah file jadi commit per fitur fiktif. Riwayat palsu lebih berbahaya daripada tidak ada.
- Format pesan: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`), subjek < 72 karakter, body menjelaskan *mengapa* kalau tidak jelas dari diff.
- Simpan rahasia: `.gitignore` sudah menolak `.env*`; `SUPABASE_SERVICE_ROLE_KEY` tidak boleh masuk commit dalam bentuk apa pun. `.env.example` sengaja ikut (placeholder) — jangan pernah diisi nilai asli.
- Migrasi yang sudah dipakai tidak boleh diedit, termasuk di dalam commit mana pun — buat file baru.

## Non-negotiable data invariants

- `kedai_stock.quantity` is **never updated bare** — every change must insert a `stock_movements` row in the same DB transaction (ledger-only audit trail).
- Transactions are **append-only** — voiding sets status `void` + reversing stock movement. Never DELETE.

## Supabase clients (don't mix up)

- `lib/supabase/client.ts` (browser) and `server.ts` (server components/actions) use the anon key, subject to RLS.
- `admin.ts` uses the **service role key and bypasses all RLS** — only for sync, stock mutations, shift reconciliation, and employee QR sessions. Every use must explicitly filter `kedai_id`; RLS won't help there. Never import it into client components; keep `SUPABASE_SERVICE_ROLE_KEY` off `NEXT_PUBLIC_`.
- Employees have **no Supabase Auth account** — only admin/owner do. Employees log in via QR token, so per-kedai restriction is enforced at the server layer, not RLS.

## Routing & auth

- `/admin/*` and `/pos/*` are deliberate top-level segments, **not** route groups — middleware distinguishes session types purely by path prefix. Don't collapse them.
- `middleware.ts` only refreshes/checks login for `/admin/*` and must preserve cookies on redirect (a plain redirect drops the refreshed session cookie → login loop).

## UI conventions

Design system is **Neo-Brutalism, white/yellow** — see `docs/design_1.md` (source of truth). Three rules that are not negotiable:

- **Radius 0** everywhere. `rounded-sm` (2px) is allowed only for badges/chips.
- **Hard offset shadows only** — `shadow-brutal-sm` / `shadow-brutal` / `shadow-brutal-lg`. No blur, no `shadow-lg`, no `drop-shadow`.
- **Solid colors, no gradients, no brand-color transparency.** Semantic colors are for status, never decoration.

- All colors/radius/shadow/font sizes live in the `@theme` block of `app/globals.css`. No raw hex in components. `text-primary` = brand **yellow** (unreadable on white); body text is `text-ink`. The old `text-text-primary` token is gone.
- Solid status colors (`#3ddc84`, `#ffd400`, …) must not be used as text on white — use the dark variants `text-success-text` / `text-warning-text` / `text-danger-text` / `text-info-text`.
- Borders: `border-2 border-ink`. Add `press-brutal` to anything clickable that has a shadow (translate 2px + shadow gone on `:active`).
- Heading font is `--font-display` (Space Grotesk, auto-`uppercase` from `@layer base`); body is `--font-sans` (Plus Jakarta Sans).
- Spacing only from the scale in `docs/design_1.md` (≈ `1,2,3,4,6,8,12,16` Tailwind). No `p-5`, `gap-7`, etc.
- Interactive POS elements ≥ 44×44px — use the `tap-target` utility.
- Icons: `lucide-react` only; no emoji as functional icons.
- Image hosting: `next.config.ts` derives `remotePatterns` from `NEXT_PUBLIC_SUPABASE_URL` at build time — storage images break if that env is missing.
- `next/font/google`: don't pass a `weight` array — Turbopack can't resolve multiple font files per query and the build fails.

### CSS payload (read before touching `globals.css`)

The bundle numbers and the reasoning behind them live in `docs/design_1.md` → "Budget Performa". Three things that look like style choices but are actually load-bearing:

- `app/globals.css` uses `@import "tailwindcss" source(none)` + an explicit `@source` list. Tailwind v4 otherwise scans every non-gitignored file — including `docs/*.md` and `AGENTS.md`, which contain the **forbidden**-class list, and ships those classes as real CSS. Adding a new directory that may hold `className`? Add it to `@source` too, or styles vanish with a green build.
- `shadow-brutal*` are `@utility` (plain `box-shadow`), **not** `--shadow-*` tokens in `@theme`. Theme shadows drag in Tailwind's whole compositor pipeline. Never use `shadow-none` for the pressed/disabled state — `press-brutal` handles `:active` and `:disabled` itself.
- No third font family. Current cost is 48.4 KB of latin subsets (26.6 + 21.8), both variable and preloaded.
