# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The frontend for AutoPost, a SaaS that posts to Facebook groups and other social accounts through a browser extension. The repo holds two apps:

- **Root:** an Angular 22 app (standalone, zoneless, signals, SCSS, Vitest) that implements the "AutoPost Dashboard" design from a Claude Design handoff. It covers the landing page, login/signup, 10 workspace screens and 6 platform-admin screens.
- **`legacy/`:** the old Vite-hosted copy of the extension's dashboard, which talks to the legacy server `backend/SIRI.AUTOPOST.Server` in `siri_autopost_backend`. See "Legacy app" below.

User-facing text comes from the TH/EN dictionary, never from literals in templates (toast and error fallbacks in `core/http` are the only exception). Code comments are in English.

## Commands (Angular app)

```bash
npm install
npm start                 # ng serve on :4200 (proxy.conf.json sends /api to http://localhost:5100)
npx ng test --watch=false # unit tests, single run (npm test = watch mode)
npx ng test --watch=false --include src/app/core/data/posts.store.spec.ts   # one spec
npm run build             # production build -> dist/siri-autopost-ui/browser
npm run format            # prettier (the only formatter; no ESLint)
npm run import:design -- <autopost-data.js>   # regenerate i18n.data.ts + seed.data.ts from a design handoff
npm run gen:api           # openapi.snapshot.json -> src/app/core/http/api-schema.ts
```

Angular CLI 22 needs Node ≥ 22.22.3 (or ≥ 24.15).

## Architecture (Angular app)

- **Data is in memory for now.** `core/data/*.store.ts` are `providedIn: 'root'` signal stores seeded from `seed.data.ts`, which is the design's sample data. Nothing calls the backend yet. Each store's methods are the seam for the API: when an endpoint exists, replace the store's internals and keep its public signals and methods. Only the session (role and plan), language and theme persist, in localStorage (`ap-session`, `ap-lang`, `ap-theme`).
- **Time.** The sample data was authored for 2026-10-03 10:30. `core/data/clock.ts` shifts every seed date by the gap between that anchor and the real "today", so the screens always look current. `PostsStore` regenerates the posts deterministically, using the same generator as the design prototype.
- **Stores.**
  - `PostsStore` holds queue/history posts and error reports. `items`/`byDay`/`today` add a day key and HH:MM to each item, and `row()` builds a list-row view.
  - `ExtensionStore` handles online/paused state and the offline policy. "Simulate offline" moves up to 4 of today's due posts to `waiting`.
  - `SettingsStore` holds the anti-ban, offline and billing preferences.
  - The remaining stores are `LibraryStore`, `TeamStore`, `AdminStore` (customers, transactions, promos, plan limits), `DraftStore` (the composer draft) and `SessionStore`.
  - Plan limits live in `AdminStore.plans` and are shared by billing, team, the extension popup and admin.
- **Derived views.** `DashboardStatsService` builds the KPIs, today's queue, the trend, accounts and recent errors for the overview and the landing preview. `core/data/plans.ts` builds the plan cards. `features/admin/AdminViewService` is provided in `admin.routes.ts` and holds the MRR, transaction rows, effective limits and sample jobs.
- **i18n.** `core/i18n/i18n.data.ts` is generated. Every leaf is a `[th, en]` pair, and `I18nService.t()` is a computed, typed dictionary for the current language. Templates read `t().section.key` and fill `{placeholders}` with `fmt()`. Data that carries both languages (`L10n` pairs in the seed) is picked with `i18n.li()`. Use `format.ts` for dates (`fmtDate` uses the Buddhist year in Thai) and baht amounts.
- **Routing (`app.routes.ts`).**
  - `/`, `/login` and `/signup?plan=` sit under `PublicLayoutComponent`, guarded by `guestGuard`.
  - `/app/*` sits under `AppLayoutComponent`, guarded by `signedInGuard`.
  - `/app/admin/*` also requires `adminGuard`, and loads `features/admin/admin.routes.ts`.
  - Every page is lazy loaded with `loadComponent`. `withComponentInputBinding()` feeds route data, query params and `:id` into `input()`s, for example `AuthPageComponent.mode`/`plan`, `CalendarPageComponent.day` and `CustomerDetailPageComponent.id`.
- **Auth.** It is a prototype like the design: any valid email signs in, and the login form's role picker chooses `user` or `admin`. There is no backend auth yet.
- **Styling.**
  - `src/styles/_tokens.scss` holds the color/space/radius/shadow tokens, with dark mode via `<html data-theme>` or the OS setting.
  - `_ds.scss` is the design-system CSS ported verbatim from the handoff bundle (`su-btn su-btn-sm su-btn-primary`, `su-input`, `su-select`, `su-check*`, `su-modal*`, `su-toast`, `su-empty*`).
  - `_app.scss` holds the repeated layout patterns: `.page`, `.page-head`, `.panel`, `.kpis/.kpi`, `.grid-2`/`.grid-2eq` (one column under 1024px), `.row`, `.status` + `.dot`, `.pico`, `.seg`, `.bar`, `.tbl/.th/.td`, `.callout`, `.tile`.
  - Components add only small local styles. Budgets: 6 kB warning / 10 kB error per component stylesheet. Icons are Phosphor font classes (`<i class="ph ph-...">`, plus `ph-fill`/`ph-bold`).
- **Shared components** (`shared/components`): `app-modal` (put the buttons in `<div modal-footer>`), `app-input-field`, `app-select-field` (`resetAfterChange` turns it into an action menu) and `app-checkbox`, all with `model()` two-way binding. Also `app-empty-state`, `app-plan-cards`, `app-cycle-switch` and `app-toast-outlet` (driven by `NotificationService`).
- **Design source.** The handoff's `AutoPost Dashboard.dc.html` is the reference for layout and copy. Its data file also contains strings for "collections / target sets / schedules" (`col`, `ts`, `sch` in the dictionary) from a later iteration that has no screens yet. The composer subtitle (`cmp.sub`) already refers to collections, as in the design.
- **Naming.** Files use the 2016 style (`*.component.ts`), and `angular.json` schematics add the type suffix to class names.

## Legacy app (`legacy/`)

```bash
cd legacy && npm install && npm run dev   # http://localhost:5173, proxies /api to VITE_BACKEND_URL (default http://localhost:8080)
```

If the legacy backend runs with `dotnet run`, it listens on 5080, so set `VITE_BACKEND_URL` to match. Every API call uses the cookie `fbap.auth` with `credentials: 'same-origin'`, so the page and the API must share an origin. `legacy/nginx.conf` proxies `/api/` to `http://backend:8080`.

- Pages: `index.html` + `web/admin.js` manage profiles and devices. `login.html` is the cookie login. `dashboard.html` + `dashboard.js` + `lib/*` are the extension's own settings page, reused as-is.
- `web/shim.js` loads before `dashboard.js` and fakes the `chrome` API on top of the legacy REST API:
  - The `settings` key maps to `/api/profiles/{id}/settings` with `baseRevision`; a 409 means the page must reload.
  - `img:<id>` keys map to `/api/profiles/{id}/images/*`.
  - `state` and `logs` come from polling `/api/devices/{id}/live`.
  - `sendMessage` becomes `POST /api/devices/{id}/commands` followed by polling `/api/commands/{id}`. Commands in `LOCAL_ONLY` are refused.

Most legacy files are copies from `siri_autopost_backend`, so keep them in sync:

| Here | Source in `siri_autopost_backend` | Differences |
|---|---|---|
| `legacy/dashboard.css`, `legacy/dashboard.js`, `legacy/lib/*`, `legacy/icons/*` | `client/` | none (byte-identical) |
| `legacy/dashboard.html` | `client/dashboard.html` | adds `web/shim.css` and `<script type="module" src="web/shim.js">` |
| `legacy/index.html`, `legacy/login.html`, `legacy/web/admin.js`, `legacy/web/shim.js` | `backend/SIRI.AUTOPOST.Server/wwwroot/` | asset and editor paths without the `/app/` prefix |
| `legacy/web/admin.css`, `legacy/web/shim.css` | `backend/SIRI.AUTOPOST.Server/wwwroot/web/` | none |
