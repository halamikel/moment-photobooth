# MOMENT · 모먼트

A Korean-style photobooth for four-cut memories: live camera capture, film
filters, draggable stickers, custom paper frames, high-resolution PNG export,
and private expiring QR sharing.

The app is a single repository with a React frontend and an Express API. Guest
sessions and media metadata live in PostgreSQL, and the images live in a private
Vercel Blob store. There are no accounts, cookies, or analytics.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Canvas 2D
- Backend: Express 5, TypeScript, Zod
- Database: PostgreSQL through `pg`
- Storage: private Vercel Blob objects, uploaded directly from the browser
- Security: Helmet, CSP, rate limiting, token authentication, prepared SQL
  statements

## Requirements

- Node.js **22.5 or newer**. Node 24 LTS is recommended.
- PostgreSQL 14 or newer.
- A Vercel Blob store and its read-write token.
- A modern browser with `getUserMedia` support.
- A secure context for camera access: `localhost` or HTTPS.

## Quick start

```bash
cp .env.example .env
# Set DATABASE_URL and BLOB_READ_WRITE_TOKEN in .env
npm install
npm run dev
```

Create the database first, for example:

```bash
createdb moment
```

Open <http://localhost:5173>. Vite proxies `/api` to the API on port 4000. The
server creates its tables on first use.

If your npm installation blocks lifecycle scripts, approve the esbuild install
script once:

```bash
npm approve-scripts esbuild
```

## Production build

```bash
npm ci
NODE_ENV=production npm run build
NODE_ENV=production npm start
```

The build writes the frontend to `dist/` and the compiled API to
`dist-server/server/index.js`. The production server serves both from the same
origin.

Use a TLS-terminating reverse proxy in front of the app. Camera access needs a
secure context, and production HSTS assumes HTTPS.

## Deploy on Vercel

The API is packaged as a single Serverless Function at `api/index.ts`. All of
the application code lives in `server/`, so Vercel does not turn each file into
its own function.

1. Import the repository into Vercel. The framework preset is detected as Vite.
2. Create a Postgres database (Neon, Supabase, Vercel Postgres, and similar work)
   and set `DATABASE_URL`. TLS is enabled automatically for non-local hosts.
3. Create a Blob store in the project and connect it. This sets
   `BLOB_READ_WRITE_TOKEN` for all environments.
4. Set `CRON_SECRET` to a random value. Vercel sends it as a Bearer token to the
   cleanup cron job.
5. Deploy.

`vercel.json` configures the build, rewrites `/api/*` to the single function,
serves `/share/*` from `index.html`, and schedules the daily cleanup cron at
`/api/cron/cleanup`.

Uploads go directly from the browser to Vercel Blob, so the 4.5 MB Serverless
Function request limit does not apply. The server issues a short-lived upload
token after checking the session token, then validates the uploaded objects
during finalize.

## Deploy with Docker

```bash
cp .env.example .env
# Set MOMENT_DOMAIN, BLOB_READ_WRITE_TOKEN, and POSTGRES_PASSWORD, then:
docker compose up -d --build
```

`docker-compose.yml` runs PostgreSQL, builds the app, runs it as a non-root user,
and puts Caddy in front with automatic TLS. The database lives in the
`postgres-data` volume. Uploaded images live in Vercel Blob, so no upload volume
is needed. Caddy state lives in `caddy-data` and `caddy-config`. On
`MOMENT_DOMAIN=localhost`, Caddy uses its internal CA, which is enough for local
camera testing.

## Deploy with systemd

The unit in `deploy/moment.service` expects the app at `/var/www/moment` and
uses systemd's `StateDirectory` to create `/var/lib/moment` with the correct
owner and permissions. Set these in `.env` before starting:

```ini
DATABASE_URL=postgres://moment:secret@127.0.0.1:5432/moment
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
CRON_SECRET=replace-with-a-random-value
TRUST_PROXY=true
```

```bash
sudo useradd --system --home /var/www/moment moment
sudo install -m 644 deploy/moment.service /etc/systemd/system/moment.service
sudo systemctl daemon-reload
sudo systemctl enable --now moment
```

Keep port `4000` bound to localhost and terminate TLS with Caddy or Nginx. The
`deploy/Caddyfile` targets Docker's `app` service; for a systemd host, use:

```
moment.example.com {
    reverse_proxy 127.0.0.1:4000
}
```

The built-in cleanup interval runs only outside Vercel. On a VPS, also schedule
an external request to `/api/cron/cleanup` if you disable the interval.

## Environment

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production`. Enables HSTS and production CSP behavior. |
| `PORT` | `4000` | API/server port. |
| `TRUST_PROXY` | `false` | Set to `true` only when running behind a trusted reverse proxy. |
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/moment` | PostgreSQL connection string. |
| `DATABASE_SSL` | auto | Force database TLS with `true` or `false`. Defaults to on for non-local hosts. |
| `BLOB_READ_WRITE_TOKEN` | none | Vercel Blob read-write token. Required for uploads and media. |
| `SESSION_TTL_HOURS` | `24` | Guest session lifetime, 1–168 hours. |
| `SHARE_TTL_HOURS` | `24` | Share-link lifetime, 1–168 hours, capped by the session expiry. |
| `WEB_DIST` | `./dist` | Built frontend directory. |
| `CRON_SECRET` | none | Bearer token required by `/api/cron/cleanup`. Required in production. |
| `MOMENT_DOMAIN` | `localhost` | Domain for the optional Caddy service in Docker Compose. |
| `POSTGRES_PASSWORD` | `moment` | Password for the Docker Compose PostgreSQL service. |

## How it works

1. The browser captures frames locally with `getUserMedia`. Nothing is uploaded
   during the shoot.
2. The user styles the strip. Canvas composites the photos, filter, paper
   theme, date, caption, and stickers into a PNG.
3. On **Develop**, the client creates a guest session, receives a one-time
   access token, and asks the API for permission to upload. The API checks the
   session token and returns a short-lived Vercel Blob upload token.
4. The browser uploads the final strip and the individual frames directly to a
   private Blob path under `media/<sessionId>/`.
5. The client finalizes the session with the uploaded object keys. The API
   verifies each object exists, matches the session, and has an allowed type and
   size, then records the session/media rows in PostgreSQL.
6. The result screen offers a local PNG download and an optional private QR
   link. Creating a new share rotates and revokes the previous token.
7. Expired sessions and their Blob objects are removed by the cleanup job.

The owner access token is held in browser memory only. Refreshing the result
screen loses owner API access; an already-created share link remains valid
until it expires. This is intentional: the raw token is never written to
`localStorage` or a cookie.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/sessions` | None | Create a guest session and return its access token. |
| `GET` | `/api/sessions/:id` | Bearer | Read the session and its media summaries. |
| `POST` | `/api/blob-upload` | Bearer | Issue a Vercel Blob client upload token. |
| `POST` | `/api/sessions/:id/finalize` | Bearer | Register uploaded strip and frame object keys. |
| `POST` | `/api/sessions/:id/share` | Bearer | Create or rotate an expiring share token. |
| `GET` | `/api/sessions/:id/media/:mediaId` | Bearer | Read owner media. Add `?download=1` for attachment. |
| `GET` | `/api/shares/:token` | Share token | Read public share metadata and media URLs. |
| `GET` | `/api/shares/:token/media/:mediaId` | Share token | Read shared media. Add `?download=1` for attachment. |
| `GET` | `/api/cron/cleanup` | Cron secret | Delete expired sessions and Blob objects. |
| `GET` | `/api/health` | None | Health check. |

Finalize accepts a JSON body with exactly one `strip` key plus the number of
`frames` keys required by the layout:

| Layout | Frames |
| --- | --- |
| `classic` | 4 |
| `grid` | 4 |
| `postcard` | 1 |

Only PNG and JPEG uploads are accepted. Each file is limited to 10MB. Object
keys must be in the form `media/<sessionId>/<uuid>.png` or `.jpg` and must
belong to the authenticated session.

## Security model

- Guest access tokens and share tokens are 256-bit random values. Only SHA-256
  hashes are stored in PostgreSQL.
- Owner endpoints require `Authorization: Bearer <token>`. Token comparison is
  constant-time.
- Share tokens expire, are capped by the session expiry, and are revoked when a
  new share is created.
- All SQL uses prepared statements. IDs are strictly parsed as positive
  integers.
- Session creation uses a strict Zod schema. Captions are stripped to plain
  text and limited to 40 characters.
- Upload tokens are scoped to one pathname under the authenticated session and
  allow only PNG/JPEG up to 10MB. Finalize re-checks each object's metadata
  before recording it.
- Media objects are private. Downloads stream through the API after its own
  authorization check.
- Helmet sets CSP, HSTS in production, `X-Frame-Options: DENY`, `nosniff`,
  no-referrer, and a restrictive permissions policy.
- Rate limits: 600 requests/15 min globally, 20 session creations/10 min, 10
  finalizes/min, 10 share creations/min, and 120 media reads/min per IP.
- The frontend uses no `dangerouslySetInnerHTML`; React escapes user-facing
  text. The API does not enable CORS and does not use cookies.
- Expired sessions are inaccessible immediately and deleted by the cleanup job
  within a day on Vercel (every 15 minutes on a VPS).

The only third-party browser request is Google Fonts. If your deployment
requires a fully self-contained privacy posture, self-host the fonts and remove
the Google Fonts entries from `index.html` and the CSP in
`server/middleware/security.ts`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the API watcher and Vite dev server together. |
| `npm run dev:api` | Run only the API with `tsx watch`. |
| `npm run dev:web` | Run only the Vite frontend. |
| `npm run typecheck` | Typecheck frontend and backend. |
| `npm run build` | Typecheck, build the frontend, and compile the API. |
| `npm start` | Run the compiled production server. |
| `npm run clean` | Remove the compiled server output. |
| `npm run preview` | Preview the Vite build locally. |

## Project layout

```text
api/index.ts          Vercel Serverless Function entry
server/               Express application
  controllers/        HTTP request/response handling
  db/                 PostgreSQL pool, schema, queries
  middleware/         Auth, security headers, rate limits, errors
  routes/             Session, share, and Blob upload routes
  services/           Finalize, share, media, storage, and cleanup logic
  utils/              Tokens, object keys, image types, HTTP helpers
shared/               Shared API contracts and layout constants
src/                  React frontend
  components/         Screens and UI components
  hooks/              Camera and element-width hooks
  lib/                Canvas composition, filters, stickers, API client
dist/                 Built frontend
dist-server/          Compiled API
```

## Deployment notes

- The in-memory rate-limit store does not coordinate across instances. For
  horizontal scaling, use a shared rate-limit store such as Redis.
- Set `TRUST_PROXY=true` only when a trusted reverse proxy supplies the client
  IP. Otherwise rate limiting can be bypassed or clients can spoof forwarding
  headers. Make sure the proxy overwrites `X-Forwarded-For` rather than
  appending untrusted client values.
- Serve the app over HTTPS. HSTS is only emitted in production, so do not enable
  production mode on a plain-HTTP origin you intend to keep using.
- The cleanup job deletes expired database rows, then best-effort deletes their
  Blob objects. In the rare event of a crash between those steps, an
  unreferenced private object can remain in the store.
- Upload objects that are never finalized are not linked to a session row. Add
  a Blob lifecycle rule or a periodic sweep of `media/` if that matters for your
  deployment.

## Validation

```bash
npm run typecheck
npm run build
```

Manual smoke testing should cover camera permission/denial, each layout, all
themes and filters, sticker drag/resize/rotate, finalize upload, download, QR
share creation, share expiry, and invalid/oversized upload rejection.
