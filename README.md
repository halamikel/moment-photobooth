# MOMENT · 모먼트

A Korean-style photobooth for four-cut memories: live camera capture, film
filters, draggable stickers, custom paper frames, high-resolution PNG export,
and private expiring QR sharing.

The app is a single repository with a React frontend and an Express API. Guest
sessions and media are stored locally in SQLite and a private upload directory.
There are no accounts, cookies, analytics, or third-party media services.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Canvas 2D
- Backend: Express 5, TypeScript, Zod, Multer
- Database: SQLite through Node's built-in `node:sqlite`
- Security: Helmet, CSP, rate limiting, token authentication, file-signature
  validation, prepared SQL statements

## Requirements

- Node.js **22.5 or newer** (`node:sqlite`). Node 24 LTS is recommended.
- A modern browser with `getUserMedia` support.
- A secure context for camera access: `localhost` or HTTPS.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to the API on port 4000.

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
`dist-server/api/index.js`. The production server serves both from the same
origin.

Use a TLS-terminating reverse proxy in front of the app. Camera access needs a
secure context, and production HSTS assumes HTTPS.

## Deploy with Docker

```bash
cp .env.example .env
# Set MOMENT_DOMAIN to your real domain, then:
docker compose up -d --build
```

`docker-compose.yml` builds the app, runs it as a non-root user, and puts Caddy
in front with automatic TLS. SQLite and uploads live in the `moment-data` and
`moment-uploads` named volumes, so they survive rebuilds. Caddy state lives in
`caddy-data` and `caddy-config`. On `MOMENT_DOMAIN=localhost`, Caddy uses its
internal CA, which is enough for local camera testing.

Back up the two app volumes together; a database row and its upload file must
stay in sync.

## Deploy with systemd

The unit in `deploy/moment.service` expects the app at `/var/www/moment` and
uses systemd's `StateDirectory` to create `/var/lib/moment` with the correct
owner and permissions. Set these in `.env` before starting:

```ini
DATABASE_PATH=/var/lib/moment/photobooth.sqlite
UPLOAD_DIR=/var/lib/moment/uploads
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

## Environment

Copy `.env.example` to `.env` and adjust as needed.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production`. Enables HSTS and production CSP behavior. |
| `PORT` | `4000` | API/server port. |
| `TRUST_PROXY` | `false` | Set to `true` only when running behind a trusted reverse proxy. |
| `DATABASE_PATH` | `./data/photobooth.sqlite` | SQLite file. Directories are created automatically. |
| `UPLOAD_DIR` | `./storage/uploads` | Private media directory. Never served statically. |
| `SESSION_TTL_HOURS` | `24` | Guest session lifetime, 1–168 hours. |
| `SHARE_TTL_HOURS` | `24` | Share-link lifetime, 1–168 hours, capped by the session expiry. |
| `WEB_DIST` | `./dist` | Built frontend directory. |
| `MOMENT_DOMAIN` | `localhost` | Domain for the optional Caddy service in Docker Compose. |

## How it works

1. The browser captures frames locally with `getUserMedia`. Nothing is uploaded
   during the shoot.
2. The user styles the strip. Canvas composites the photos, filter, paper
   theme, date, caption, and stickers into a PNG.
3. On **Develop**, the client creates a guest session, receives a one-time
   access token, and uploads the final strip plus the individual frames.
4. The API validates the images, writes them under UUID filenames, and records
   the session/media rows in SQLite.
5. The result screen offers a local PNG download and an optional private QR
   link. Creating a new share rotates and revokes the previous token.
6. Expired sessions and their files are removed by a cleanup job every 15
   minutes.

The owner access token is held in browser memory only. Refreshing the result
screen loses owner API access; an already-created share link remains valid
until it expires. This is intentional: the raw token is never written to
`localStorage` or a cookie.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/sessions` | None | Create a guest session and return its access token. |
| `GET` | `/api/sessions/:id` | Bearer | Read the session and its media summaries. |
| `POST` | `/api/sessions/:id/finalize` | Bearer | Upload `strip` and `frame_0…frame_3` images. |
| `POST` | `/api/sessions/:id/share` | Bearer | Create or rotate an expiring share token. |
| `GET` | `/api/sessions/:id/media/:mediaId` | Bearer | Read owner media. Add `?download=1` for attachment. |
| `GET` | `/api/shares/:token` | Share token | Read public share metadata and media URLs. |
| `GET` | `/api/shares/:token/media/:mediaId` | Share token | Read shared media. Add `?download=1` for attachment. |
| `GET` | `/api/health` | None | Health check. |

Finalize accepts exactly one `strip` file plus the number of frames required by
the layout:

| Layout | Frames |
| --- | --- |
| `classic` | 4 |
| `grid` | 4 |
| `postcard` | 1 |

Only PNG and JPEG uploads are accepted. Each file is limited to 10MB and must
match its declared MIME type by file signature.

## Security model

- Guest access tokens and share tokens are 256-bit random values. Only SHA-256
  hashes are stored in SQLite.
- Owner endpoints require `Authorization: Bearer <token>`. Token comparison is
  constant-time.
- Share tokens expire, are capped by the session expiry, and are revoked when a
  new share is created.
- All SQL uses prepared statements. IDs are strictly parsed as positive
  integers.
- Session creation uses a strict Zod schema. Captions are stripped to plain
  text and limited to 40 characters.
- Uploads use memory storage with Multer limits, PNG/JPEG magic-byte checks, and
  UUID filenames written with mode `0600`. Uploads are never exposed through a
  static path.
- Helmet sets CSP, HSTS in production, `X-Frame-Options: DENY`, `nosniff`,
  no-referrer, and a restrictive permissions policy.
- Rate limits: 600 requests/15 min globally, 20 session creations/10 min, 10
  uploads/min, 10 share creations/min, and 120 media reads/min per IP.
- The frontend uses no `dangerouslySetInnerHTML`; React escapes user-facing
  text. The API does not enable CORS and does not use cookies.
- Expired sessions are inaccessible immediately and deleted by the cleanup job
  within 15 minutes.

The only third-party browser request is Google Fonts. If your deployment
requires a fully self-contained privacy posture, self-host the fonts and remove
the Google Fonts entries from `index.html` and the CSP in
`api/middleware/security.ts`.

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
api/                  Express application
  controllers/        HTTP request/response handling
  db/                 SQLite connection, schema, prepared queries
  middleware/         Auth, security headers, uploads, rate limits, errors
  routes/             Session and share routes
  services/           Finalize, share, media, and cleanup logic
  utils/              Tokens, files, image sniffing, HTTP helpers
shared/               Shared API contracts and layout constants
src/                  React frontend
  components/         Screens and UI components
  hooks/              Camera and element-width hooks
  lib/                Canvas composition, filters, stickers, API client
data/                 SQLite database (ignored by git)
storage/uploads/      Private uploaded media (ignored by git)
dist/                 Built frontend
dist-server/          Compiled API
```

## Deployment notes

- This setup is designed for a single application instance. SQLite and the
  in-memory rate-limit store do not coordinate across multiple instances. For
  horizontal scaling, move sessions/media to a shared database and object
  storage, and use a shared rate-limit store such as Redis.
- Keep `UPLOAD_DIR` outside the web root and restrict it to the application
  user, for example `chmod 700 data storage storage/uploads`.
- Back up the SQLite database and upload directory together. A database row and
  its file must stay in sync.
- Set `TRUST_PROXY=true` only when a trusted reverse proxy supplies the client
  IP. Otherwise rate limiting can be bypassed or clients can spoof forwarding
  headers. Make sure the proxy overwrites `X-Forwarded-For` rather than
  appending untrusted client values.
- Serve the app over HTTPS. HSTS is only emitted in production, so do not enable
  production mode on a plain-HTTP origin you intend to keep using.
- The cleanup job removes expired database rows first and then best-effort
  deletes their files. In the rare event of a crash between those steps, an
  unreferenced private file can remain in `UPLOAD_DIR`.

## Validation

```bash
npm run typecheck
npm run build
```

Manual smoke testing should cover camera permission/denial, each layout, all
themes and filters, sticker drag/resize/rotate, finalize upload, download, QR
share creation, share expiry, and invalid/oversized upload rejection.
