# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The frontend for SIRI.AUTOPOST. The repo holds two apps:

- **Root:** a new Angular 22 app (standalone components, zoneless, signals, SCSS, Vitest). It talks to `SIRIAUTOPOST.Api`, the Clean Architecture solution under `src/` in the sibling repo `siri_autopost_backend`. It's a skeleton with one complete sample feature (`features/auto-post`).
- **`legacy/`:** the old Vite-hosted copy of the extension's dashboard, which talks to the legacy server `backend/SIRI.AUTOPOST.Server`. See "Legacy app" below.

User-facing strings are in **Thai**, and code comments are in English.

## Commands (Angular app)

```bash
npm install
npm start                 # ng serve on :4200; proxy.conf.json sends /api to http://localhost:5100
npm test                  # ng test (Vitest + jsdom), watch mode
npx ng test --watch=false # single run
npx ng test --watch=false --include src/app/features/auto-post/state/posts.store.spec.ts   # one spec
npm run build             # production build -> dist/siri-autopost-ui/browser
npm run gen:api           # openapi.snapshot.json -> src/app/core/http/api-schema.ts
npm run format            # prettier
```

Angular CLI 22 needs Node ≥ 22.22.3 (or ≥ 24.15). There's no ESLint setup; Prettier (`.prettierrc`) is the only formatter.

## Architecture (Angular app)

- **Folder rules.** `core/` holds singletons used everywhere and never imports from `features/`. `shared/` holds dumb, reusable components, directives and pipes. `layouts/` has `main-layout` (header + sidebar) and `auth-layout`. Each folder in `features/<name>/` owns its own `components/` (dumb), `pages/` (routable, smart), `services/` (HTTP only), `state/` (signal stores), `models/` and a lazy-loaded `<name>.routes.ts`.
- **Routing.** `app.routes.ts` mounts `MainLayoutComponent`, guarded by `authGuard`, with feature children loaded through `loadChildren`, and mounts `/login` under `AuthLayoutComponent`. `withComponentInputBinding()` binds route and query params to `input()`s; for example, `LoginPageComponent.next` reads `?next=`.
- **State.** Feature stores are `@Injectable()` classes (not `providedIn: 'root'`) listed in the feature route's `providers`, like `PostsStore` in `auto-post.routes.ts`. They expose read-only signals and `async` methods that call the `*ApiService` with `firstValueFrom`.
- **API types.** DTOs are generated, not hand-written. `core/http/api-schema.ts` is produced by `npm run gen:api` from `openapi.snapshot.json`, which is copied from the backend's `/openapi/v1.json`. Feature models alias `components['schemas'][...]`. When the backend contract changes, refresh the snapshot, regenerate, then fix the compile errors.
- **Errors.** `errorInterceptor` shows a toast through `NotificationService` for every failed call except 400. A 400 carries `ValidationProblemDetails`, and the calling store passes its `errors` (camelCase field keys) down to the form. On a 401 it logs out and redirects to `/login`.
- **Auth.** It's built but switched off. `environment.authEnabled` is `false` because the new API has no `/api/auth/login` yet. With the flag off, `AuthStore.isAuthenticated` is always true.
- **Styling.** Global tokens are CSS variables in `src/styles/_tokens.scss`, using the AutoPost Dashboard palette from the design handoff. Light/dark is controlled by `ThemeService`: `<html data-theme>`, falling back to the OS preference. Components use only the variables plus the global `.btn`, `.field` and `.card` primitives from `_base.scss`. The production budget for any one component style is 4 kB (warning) / 8 kB (error).
- **Naming.** The workspace uses the 2016 file-name style (`*.component.ts`, `*.service.ts`), and `angular.json` schematics add the type suffix to class names, so `ng g c` stays consistent.

## Legacy app (`legacy/`)

```bash
cd legacy && npm install && npm run dev   # http://localhost:5173, proxies /api to VITE_BACKEND_URL (default http://localhost:8080)
```

If the legacy backend runs with `dotnet run`, it listens on 5080, so set `VITE_BACKEND_URL` to match. Every API call uses the cookie `fbap.auth` with `credentials: 'same-origin'`, so the page and the API must share an origin. `legacy/nginx.conf` proxies `/api/` to `http://backend:8080`.

- Pages: `index.html` + `web/admin.js` manage profiles and devices. `login.html` is the cookie login. `dashboard.html` + `dashboard.js` + `lib/*` are the extension's own settings page, reused as-is.
- `web/shim.js` loads before `dashboard.js` and fakes the `chrome` API on top of the legacy REST API. The `settings` key maps to `/api/profiles/{id}/settings` with `baseRevision`, where a 409 means the page must reload. `img:<id>` keys map to `/api/profiles/{id}/images/*`. `state` and `logs` come from polling `/api/devices/{id}/live`. `sendMessage` becomes `POST /api/devices/{id}/commands` followed by polling `/api/commands/{id}`. Commands in `LOCAL_ONLY` are refused.

Most legacy files are copies from `siri_autopost_backend`, so keep them in sync:

| Here | Source in `siri_autopost_backend` | Differences |
|---|---|---|
| `legacy/dashboard.css`, `legacy/dashboard.js`, `legacy/lib/*`, `legacy/icons/*` | `client/` | none (byte-identical) |
| `legacy/dashboard.html` | `client/dashboard.html` | adds `web/shim.css` and `<script type="module" src="web/shim.js">` |
| `legacy/index.html`, `legacy/login.html`, `legacy/web/admin.js`, `legacy/web/shim.js` | `backend/SIRI.AUTOPOST.Server/wwwroot/` | asset and editor paths without the `/app/` prefix |
| `legacy/web/admin.css`, `legacy/web/shim.css` | `backend/SIRI.AUTOPOST.Server/wwwroot/web/` | none |
