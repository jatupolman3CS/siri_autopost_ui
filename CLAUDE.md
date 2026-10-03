# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The frontend for AutoPost, a SaaS that posts to Facebook groups and other social accounts through a browser extension. The repo holds two apps:

- **Root:** an Angular 22 app (standalone, zoneless, signals, SCSS, Vitest) that implements the "AutoPost Dashboard" design from a Claude Design handoff. It covers the landing page, login/signup, 10 workspace screens and 6 platform-admin screens.
- **`legacy/`:** the old Vite-hosted copy of the extension's dashboard, which talks to the legacy server `backend/SIRI.AUTOPOST.Server` in `siri_autopost_backend`. See "Legacy app" below.

User-facing text comes from the TH/EN dictionary, never from literals in templates (toast and error fallbacks in `core/http` are the only exception). Strings the design handoff lacks go in `core/i18n/i18n.extra.ts` (`t().api.*`), not in the generated `i18n.data.ts`. Code comments are in English.

## Commands (Angular app)

```bash
npm install
npm start                 # ng serve on :4200 (proxy.conf.json sends /api to SIRIAUTOPOST.Api on http://localhost:5100; start it first)
npx ng test --watch=false # unit tests, single run (npm test = watch mode)
npx ng test --watch=false --include src/app/core/data/posts.store.spec.ts   # one spec
npm run build             # production build -> dist/siri-autopost-ui/browser
npm run format            # prettier (the only formatter; no ESLint)
npm run import:design -- <autopost-data.js>   # regenerate i18n.data.ts + seed.data.ts from a design handoff
npm run gen:api           # openapi.snapshot.json -> src/app/core/http/api-schema.ts (prettier-formatted)
docker build -t siriautopost-web .   # nginx image: dist + /api proxy to http://api:8080 (nginx.conf)
```

The whole stack (PostgreSQL + API + this app) runs with `docker-compose.saas.yml` in `siri_autopost_backend`, which builds this repo from `UI_PATH` (default `../siri_autopost_ui`).

Angular CLI 22 needs Node ≥ 22.22.3 (or ≥ 24.15).

CI (`.github/workflows/ci.yml`) runs `prettier --check`, checks that `npm run gen:api` leaves `api-schema.ts` unchanged (commit the regenerated file with the snapshot), builds, runs the unit tests, builds `legacy/` and the Docker image.

## Architecture (Angular app)

- **Data comes from `SIRIAUTOPOST.Api`** (backend repo). `core/http/api.service.ts` is the only place that calls `HttpClient`: typed methods (types from `api-schema.ts`) that return promises. `core/data/*.store.ts` are `providedIn: 'root'` signal stores on top of it; pages read their signals and await their methods.
- **Auth.** `SessionStore` logs in/signs up against `/api/auth`, keeps the JWT in localStorage (`ap-token`, `core/auth/token.ts`) and checks it with `/api/auth/me` in `provideAppInitializer` before the first navigation. `authInterceptor` adds the bearer header and sends the user to `/login` on a 401. `errorInterceptor` toasts failures except 400s, 401s and requests sent with the `QUIET` context (login, signup, uploads), whose callers show their own errors. The role (`user`/`admin`) and plan come from the server.
- **Workspaces.** `WorkspaceStore` loads the user's workspaces after sign-in and remembers the current one (`ap-ws`). Workspace-scoped stores call `whenWorkspaceChanges()` in their constructor to reset and reload when it changes (and to empty themselves on sign-out).
- **Stores.**
  - `PostsStore` loads posts a calendar month at a time (`ensureMonth`; the months around today on load, the calendar asks for the rest) plus the open error reports, and `refresh()` re-reads both after every change. `items`/`byDay`/`today` add a day key and HH:MM; `postRow()` builds a list row. `now` is a signal that ticks every 30 s.
  - `AccountsStore` holds the social accounts (health, groups, `connected`); `reconnect()` marks one signed in again. Accounts that are not `connected` are the sample accounts of a new workspace: their posts are never sent, so the composer and overview label them "ตัวอย่าง".
  - `SettingsStore` holds the anti-ban and offline settings from `/engine` (edited locally, sent by `saveAb()`/`saveOff()`), the extension's presence (`extensionOnline`, `simulatedOffline`, `devices`, `devicesOnline`), and `usedToday` (today's sent posts per platform). Every minute it refreshes only the presence (quietly, so edits in progress survive) and, when a device is paired, the posts. Billing preferences stay local.
  - `ExtensionStore` runs the offline simulation through `/engine/extension` and `/engine/waiting/skip`; `unpaired`/`simulated` decide what the top bar and the offline banner show. Pausing is local to the popup preview.
  - `DevicesStore` lists the browsers paired to the workspace, creates pairing codes and unbinds devices. `features/team/PairDeviceModalComponent` shows the code and this site's origin (the extension calls `<origin>/api/device/*`), polls the device list every 3 s and closes when a new device appears.
  - `LibraryStore` lists and uploads media and creates snippets. Image thumbnails are fetched as blobs with the token and shown through object URLs (an `<img src>` cannot send the header).
  - `DraftStore` holds the composer draft. Until the user picks targets (`autoTargets`), the targets are a connected group account with three of its groups or, without one, the design default (the first group-posting account with three groups, plus Instagram). Editing a queued post sets `replaces`, and the old post is deleted once the new one is scheduled.
  - `TeamStore` lists the current workspace's people (`/members`: the owner row has `id` null, pending invitations have `active` false), invites, changes roles and removes or leaves. `role`/`canManage` come from the workspace's `role` in `WorkspaceStore`. The team page disables inviting while the owner's plan has one seat; the server enforces seats and roles (403 for too low a role).
  - `AdminStore` holds the platform-admin data from `/api/admin/*` (customers, transactions, promo codes, subscription counts, 12 months of revenue, jobs) and the plans from the public `/api/plans`. `loadPlans()` runs in the app initializer; `load()` runs whenever the admin area is entered (`provideEnvironmentInitializer` in `admin.routes.ts`). Plan limits in `AdminStore.plans` are shared by billing, team, the extension popup, the landing page and admin.
  - Billing: `SessionStore.setPlan(plan, cycle, promoCode)` records the charge on the server; invoices come from `/api/billing/invoices`. No payment provider is connected, so nothing is charged and the card form is still local.
  - `AdminStore.health` (`/api/admin/health`) feeds the admin overview's KPIs and system-health panel; `AdminStore.audit` (`/api/admin/audit?customerId=`) is the customer page's activity log, reloaded whenever that customer's row changes (every admin action replaces it).
  - Assist mode: "assist" on a customer calls `SessionStore.startAssist(id)`, which keeps the admin's token in `ap-assist` (`assistStorage`) and signs in with the customer's one-hour, read-only token. `AppLayoutComponent` shows the assist banner with "back to admin" (`endAssist()`); an expired assist token (401 in `authInterceptor`, or at `restore()`) also goes back to the admin. `WorkspaceStore` reloads whenever the signed-in user's id changes, so the switch reloads every workspace store.
  - **Still sample data:** billing card and notification preferences, the extension popup log. `core/data/sample.ts` (the design's post generator and texts) feeds the landing-page preview; `clock.ts` shifts seed dates to today.
- **Errors.** `core/http/problem-details.ts` `problemOf(e)?.title` is the API's Thai message; forms that send `QUIET` requests (invite, pairing) show it inline. A 403 on login means a suspended or banned account (`t().api.blocked`). `ago(t, date)` in `i18n.service.ts` formats last-seen times.
- **Derived views.** `DashboardStatsService` builds the KPIs, today's queue, the trend, accounts and recent errors for the overview; its pure helpers `kpisOf`/`queueRowsOf` also build the landing preview from sample posts. `core/data/plans.ts` builds the plan cards. `features/admin/AdminViewService` is provided in `admin.routes.ts` and holds the MRR, transaction rows, effective limits and job rows.
- **i18n.** `core/i18n/i18n.data.ts` is generated. Every leaf is a `[th, en]` pair, and `I18nService.t()` is a computed, typed dictionary for the current language. Templates read `t().section.key` and fill `{placeholders}` with `fmt()`. Data that carries both languages (`L10n` pairs in the seed) is picked with `i18n.li()`. Use `format.ts` for dates (`fmtDate` uses the Buddhist year in Thai) and baht amounts.
- **Routing (`app.routes.ts`).**
  - `/`, `/login` and `/signup?plan=` sit under `PublicLayoutComponent`, guarded by `guestGuard`.
  - `/app/*` sits under `AppLayoutComponent`, guarded by `signedInGuard`.
  - `/app/admin/*` also requires `adminGuard`, and loads `features/admin/admin.routes.ts`.
  - Every page is lazy loaded with `loadComponent`. `withComponentInputBinding()` feeds route data, query params and `:id` into `input()`s, for example `AuthPageComponent.mode`/`plan`, `CalendarPageComponent.day` and `CustomerDetailPageComponent.id`.
- **Styling.**
  - `src/styles/_tokens.scss` holds the color/space/radius/shadow tokens, with dark mode via `<html data-theme>` or the OS setting.
  - `_ds.scss` is the design-system CSS ported verbatim from the handoff bundle (`su-btn su-btn-sm su-btn-primary`, `su-input`, `su-select`, `su-check*`, `su-modal*`, `su-toast`, `su-empty*`).
  - `_app.scss` holds the repeated layout patterns: `.page`, `.page-head`, `.panel`, `.kpis/.kpi`, `.grid-2`/`.grid-2eq` (one column under 1024px), `.row`, `.status` + `.dot`, `.pico`, `.seg`, `.bar`, `.tbl/.th/.td`, `.callout`, `.tile`.
  - Components add only small local styles. Budgets: 6 kB warning / 10 kB error per component stylesheet. Icons are Phosphor font classes (`<i class="ph ph-...">`, plus `ph-fill`/`ph-bold`).
- **Tests.** Store and page specs use `src/app/testing/api-testing.ts`: `provideApiTesting()` sets up `HttpTestingController`, `signIn()` logs in and answers the workspace loads, `settle()` lets promises and effects run.
- **API contract.** After the backend's API changes, refresh `openapi.snapshot.json` (`curl localhost:5100/openapi/v1.json`) and run `npm run gen:api`; `api.service.ts` re-exports the schema types under `Api*` names.
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
