# CLAUDE.md

Context for AI coding sessions on this repo. Read this first, then `design/README.md` for screens, rules and visual language.

## What this is

**Chia bill nhóm**: a mobile-first, Vietnamese-UI web app for splitting bills at a group outing. The organiser builds a party (members → bills → summary → QR → share), and everyone else opens a read-only link, picks "Tôi là…", scans the organiser's QR and marks "Đã trả".

- Owner: Tan (personal side project, not Plenti work). Repo: https://github.com/tanngocIT/chia-bill. Hosting: **GitHub Pages** at https://tanngocit.github.io/chia-bill/ (static only).
- Design canvas: https://claude.ai/code/artifact/3712e4d0-9fb3-4047-a321-04fc3d27dda4 (copy in `design/canvas/`).
- Design system: Plenti Design System (tokens copied to `design/tokens.json`).

## Commands

```bash
npm install
npm run dev        # Vite dev server, http://localhost:5173
npm test           # vitest: split, rounding, settlement, VietQR payload
npm run typecheck  # tsc
npm run build      # tsc -b && vite build → dist/
```

Always run `npm run typecheck && npm test && npm run build` before calling a change done.

## Stack

- Vite 8, React 18, TypeScript (strict), plain CSS in `src/styles.css`. No Tailwind or UI library, on purpose.
- Only three runtime deps: `@supabase/supabase-js`, `lz-string`, React.
- **Hash routing** (`#/…`) because GitHub Pages has no server rewrites; `vite.config.ts` uses `base: './'`.

## Architecture

```
src/
  App.tsx              hash router: #/ · #/p/:id/sua?k=KEY (organiser) · #/p/:id (viewer, Supabase) · #/v/:data (viewer, data-in-link)
  lib/
    types.ts           Party, Member, Bill, BankInfo, Tx, PaidMap
    calc.ts            calcBill (sponsorship → split → 1.000đ rounding to payer), settleHub, settleMin, summarize
    format.ts          vnd(), num(), r1k(), initial(), dateVi(), ascii(), ids
    qr.ts              self-contained QR encoder (byte mode, ECC M) → SVG path (100×100 viewBox)
    vietqr.ts          EMVCo/NAPAS VietQR payload + CRC16, bank BIN list
    image.ts           client-side image compression (canvas → JPEG data URL)
    sample.ts          sample party (5 members, 3 bills) + colour palettes
    calc.test.ts       unit tests: keep these green, add cases when touching calc/qr/vietqr
  data/
    store.ts           Store interface + "my parties" list in localStorage
    local.ts           no-backend store: localStorage + party encoded (lz-string) into the share link
    supabase.ts        Supabase store: all access via RPC functions, realtime broadcast + 30s polling
    index.ts           picks Supabase if VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, else local
  components/ui.tsx    Icon (ICONS map), Avatar, Cover, Seg, QrSvg, MoneyInput, Empty, Confetti, ConfirmDialog, Toast, ThemeButton, copyText
  screens/
    Home.tsx           create / sample / my parties
    Organizer.tsx      6-step wizard, autosave (700ms debounce), desktop sidebar + aside
    steps.tsx          StepParty, StepMembers, StepBills (swipe), StepSummary, StepQr, StepShare, Aside
    BillEditor.tsx     bottom sheet / modal editor
    Viewer.tsx         public page
supabase/schema.sql    tables (RLS on, no policies) + SECURITY DEFINER RPCs
.github/workflows/deploy.yml  GitHub Actions: test, build, deploy to Pages on push to main
design/                design spec, canvas source, tokens, screenshots
```

Data model: one `Party` JSON document (members, bills, bank info with optional QR images) plus a separate `PaidMap` (`"fromId>toId" → boolean`). Transactions are always **derived** from the party with `summarize()` and never stored.

## Business rules (don't break)

- VND integers only. Display as `1.250.000đ` via `vnd()`.
- Sponsorship first. Remainder split equal / amount / percent. Equal and % shares round to 1.000đ, and the difference goes to the payer (or the first participant if the payer isn't one).
- Settlement default `settleMode: 'hub'`: everyone pays the organiser, and the organiser repays whoever covered bills. `'min'` = fewest transfers.
- Custom splits must sum exactly. Validation messages live in `calcBill().errs` (Vietnamese).
- VietQR transfer note: `ascii("<from> tra <to>")`, ≤ 25 chars.

## Conventions

- **All user-facing copy is Vietnamese**, friendly and short. Code, comments and commits are in English.
- Follow the design tokens in `src/styles.css` (CSS variables; dark theme via `[data-theme]` and `prefers-color-scheme`). Don't hard-code new colours; reuse the variables.
- No emoji in the UI. Use inline stroke icons from `ICONS` in `components/ui.tsx`.
- Tap targets ≥ 44px. Real `<button>`/`<label>`/`<input>` elements; `aria-label` on icon-only buttons.
- Mobile-first CSS. Desktop overrides live in the single `@media (min-width: 1024px)` block.
- Generic element resets go inside `:where()` so component classes win (a past bug made button text black).
- Party updates go through `update(fn)` in Organizer, which structured-clones and autosaves. Don't mutate state directly.
- Keep `lib/` free of React and DOM, except `image.ts`, so it stays unit-testable.

## Backend

- Default: **no backend**. Works on GitHub Pages as-is; the limits are that "Đã trả" is per device and images are dropped from share links.
- **Supabase** (recommended): run `supabase/schema.sql`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` locally, or as GitHub repo **Variables** for CI. The anon key is public by design; security comes from the RPC functions, and the organiser key is stored as a SHA-256 hash.
- Adding another backend = one file implementing `Store` (`create/load/save/setPaid/remove/watch/viewRoute`), then choose it in `data/index.ts`.

## Gotchas

- GitHub Pages must be set to Settings → Pages → Source: **GitHub Actions** (one-time).
- Run `npm install` on the machine you develop on. Don't copy `node_modules` between Windows and Linux (esbuild/rollup binaries are platform-specific).
- Share links in no-backend mode can get long. `StepShare` hides the link QR above ~1800 chars.
- Images are stored as data URLs inside the party JSON (receipts ≤ 600KB, QR ≤ 400KB after compression). If size becomes a problem, move them to Supabase Storage.
- The canvas `*.dc.html` files in `design/canvas/` only render in the Claude Design canvas.

## Status / next ideas

Done:
- Full wizard, bill editor, viewer, light/dark, mobile + desktop, local + Supabase stores, unit tests, GitHub Pages workflow.

Not yet done:
- Git repo init and first deploy.
- Supabase project creation.
- Real-bank scan test of the VietQR codes.
- Possible later: Supabase Storage for images, PWA/offline, i18n, e2e tests (Playwright), "copy transfer note" button, per-bill receipt viewer in the public page.
