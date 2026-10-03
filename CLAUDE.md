# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A standalone web frontend for FB AutoPost Online. Admins use it to manage configs ("profiles"), manage the computers that run the Chrome extension ("devices"), issue device keys, and edit configs online. It's plain HTML/CSS/vanilla ES modules, bundled by Vite as a multi-page app. There's no framework and no TypeScript.

All of the backend logic lives in the sibling repo `siri_autopost_backend` (an ASP.NET Core + PostgreSQL API, plus the Chrome extension under `client/`). This repo only calls its `/api/*` endpoints. User-facing strings are in **Thai**, and code comments are in English.

## Commands

```bash
npm install
cp .env.example .env     # VITE_BACKEND_URL, default http://localhost:8080
npm run dev              # http://localhost:5173, proxies /api -> VITE_BACKEND_URL
npm run build            # -> dist/
npm run preview

docker build -t siri-autopost-ui . && docker run -d -p 80:80 siri-autopost-ui
```

There are no tests and no linter. If the backend runs with `dotnet run`, it listens on `http://localhost:5080`, not 8080, so set `VITE_BACKEND_URL` to match. Every API call uses the cookie `fbap.auth` with `credentials: 'same-origin'`, so the UI and the API must share an origin, either through the Vite proxy in dev or through nginx in Docker. In production, `nginx.conf` proxies `/api/` to `http://backend:8080`, so it expects a container reachable under the hostname `backend`.

## Pages (Vite inputs in `vite.config.js`)

- `index.html` + `web/admin.js`: the profile and device management page. It opens the editor at `/dashboard.html?profile=<id>&device=<id>`.
- `login.html`: the cookie login, using `/api/auth/login` and redirecting to `?next=`.
- `dashboard.html` + `dashboard.js` + `lib/*`: the Chrome extension's own settings page, reused as-is. It only touches `chrome.storage.local`, `chrome.runtime.sendMessage` and `chrome.permissions`.
- `web/shim.js` loads before `dashboard.js` and defines a fake `chrome` object backed by the API:
  - The `settings` storage key maps to `GET/PUT /api/profiles/{id}/settings`, with `baseRevision` for optimistic concurrency. A 409 means someone else saved first and the page must reload.
  - `img:<id>` keys map to `/api/profiles/{id}/images/*`.
  - `state` and `logs` come from polling `GET /api/devices/{id}/live`.
  - `sendMessage({ target: 'fbap-bg', cmd })` becomes `POST /api/devices/{id}/commands`. The shim then polls `GET /api/commands/{id}`, because the real extension picks the command up on its 30s heartbeat. Commands listed in `LOCAL_ONLY` are refused.
  - If `dashboard.js` starts using another chrome API, the shim has to implement it.

## Copied from `siri_autopost_backend`

Most of this repo is copied from the backend repo, so keep the two in sync:

| Here | Source in `siri_autopost_backend` | Differences |
|---|---|---|
| `dashboard.css`, `dashboard.js`, `lib/*`, `icons/*` | `client/` | none (byte-identical) |
| `dashboard.html` | `client/dashboard.html` | adds `web/shim.css` and `<script type="module" src="web/shim.js">` |
| `index.html`, `login.html`, `web/admin.js`, `web/shim.js` | `backend/AutoPost.Server/wwwroot/` | asset and editor paths without the `/app/` prefix |
| `web/admin.css`, `web/shim.css` | `backend/AutoPost.Server/wwwroot/web/` | none |

Changes to the dashboard or `lib/` usually start in the extension, which is the source of truth, and are then copied here. Shared modules such as `lib/shared.js` (settings defaults and `migrateSettings`) define the settings JSON shape that the backend also parses in `Services/Helpers.cs` (`SettingsJson`).
