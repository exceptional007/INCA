# Deploy INCA: Render backend + Netlify frontend

The existing Supabase database and Cloudflare R2 bucket stay in place. Render runs NestJS; Netlify serves the Vite build. The auth/profile migration has already been applied to the currently configured Supabase database. Deployment does not seed, reset, or recreate that database.

## Repository configuration

| Host | Settings |
| --- | --- |
| Render | Root `backend`; Node 24; build `npm ci --include=dev && npm run prisma:generate && npm run build`; start `npm run start:prod`; health `/health` |
| Netlify | Root `netlify.toml`; base `frontend`; build `npm run build:netlify`; publish `dist`; Node 24 |

`render.yaml` creates only the backend, using the free plan initially and manual deploys. No paid service, new database, or disk is provisioned. Select an always-on paid instance yourself if required. The free service sleeps while idle, which delays scheduled notice publication until it wakes; it is suitable for demos. R2 stores uploads independently of Render's ephemeral disk. The Gmail gateway uses HTTPS and does not need SMTP ports.

The current local branch is `backend-dev`, with the previous feature/security fixes still uncommitted. Hosts cannot see those local changes until the intended code is committed and pushed. Review the full working tree before publishing it; `.env`, `.tmp`, backups, and generated imports must remain ignored. Do not deploy the old GitHub checkpoint expecting the new features to exist.

## 1. Create/select the Netlify project and obtain its URL

In Netlify, import `exceptional007/INCA` from GitHub and select the branch containing the reviewed deployment changes. Choose the site name and note its actual `https://…netlify.app` origin. Use the root `netlify.toml`, which sets `frontend` as the base directory. Do not set `frontend/frontend` or expose the backend directory as the publish directory.

The frontend build deliberately fails until `VITE_API_URL` is supplied. If the initial imported build runs before Render exists, leave that failed build unpublished and finish the next steps; then redeploy. A missing API URL must not silently produce a deployed app pointing at localhost.

If you already have a Netlify site, use its existing URL and update its repository/branch/build settings instead of creating a duplicate site.

## 2. Prepare Render's private environment

Run this locally, replacing the example with the actual Netlify origin:

```powershell
cd backend
node scripts/prepare-render-env.cjs --frontend-url=https://YOUR-ACTUAL-SITE.netlify.app
```

It reads your ignored local `.env` and creates **`backend/.tmp/render-production.env`**, also ignored by Git. Import that file into Render's environment settings. It contains secrets: never upload it to Netlify, commit it, or paste its values into chat.

The export includes:

| Variables | Source / setting |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Existing Supabase URLs; preserve their exact values and connection options |
| `JWT_SECRET` | Existing backend secret |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` | Existing private R2 configuration |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Existing AI configuration when supplied |
| `PASSWORD_MAIL_PROVIDER`, `PASSWORD_MAIL_API_URL`, `PASSWORD_MAIL_API_KEY` | Existing authenticated Gmail gateway settings |
| `FRONTEND_URL` | Actual Netlify HTTPS origin, no path or trailing slash |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` |
| `AUTH_COOKIE_SAME_SITE` | `lax`, because authentication is proxied through the frontend origin |
| `TRUST_PROXY_HOPS` | `1`, trusting Render's nearest reverse proxy |

Do not copy the local `PORT=3000`; Render provides its own port. The application binds to `0.0.0.0` and uses Render's `PORT`. Missing R2 settings make uploads fail; missing AI settings affect AI features.

## 3. Create/select the Render web service

Either import the repository's root `render.yaml` as a Render Blueprint, or create a **Node Web Service** with the settings in the first table. Select the same reviewed Git branch used for Netlify. Add/import the environment before the first successful deploy.

The Blueprint intentionally has no automatic migration/seed command. For the existing configured database the migration is already applied. For future releases, review and apply intended migrations before the matching code release using `npm run db:migrate:deploy`. Never use `prisma migrate reset` or `prisma db push --accept-data-loss` on this database. Migration history does not reproduce every legacy module from scratch.

When the deploy completes, open:

```text
https://YOUR-ACTUAL-API.onrender.com/health
```

Expected: HTTP 200, `status: "ok"`, database `status: "up"`. Copy the actual Render URL rather than assuming the service name guarantees a particular hostname. Existing Render services can be updated using these settings without creating another service.

## 4. Connect and deploy Netlify

Set these **build-time** Netlify variables:

```dotenv
VITE_API_URL=https://YOUR-ACTUAL-API.onrender.com/api/v1
VITE_AUTH_API_URL=/api/v1
```

`VITE_AUTH_API_URL` is already provided by `netlify.toml`; retain it. No database, R2, Gemini, JWT, or email credentials belong in Netlify/Vite variables. Redeploy after changing a `VITE_` variable because Vite embeds it into the build.

`build:netlify` generates `dist/_redirects` using the actual Render URL:

- `/api/v1/auth/*` is proxied to Render at the same path, before the SPA fallback. Refresh cookies therefore belong to the Netlify origin, remain HttpOnly/Secure in production, and do not rely on third-party cookies.
- Legacy same-origin student photo URLs are also proxied.
- Other API calls, large uploads, authenticated document downloads, and Socket.IO connect directly to Render using `VITE_API_URL`.
- Other frontend routes rewrite to `/index.html`, so reloading `/profile`, `/notices`, or `/reset-password` works.

Do not proxy all API traffic through Netlify: its proxy request timeout can interrupt longer timetable imports/uploads. The generated deployment contains no backend secrets.

## 5. Update the Gmail gateway origin

In the already deployed Google Apps Script, set Script Property **`INCA_FRONTEND_URL`** to the same actual Netlify origin as Render's `FRONTEND_URL`. Keep the shared key unchanged. This makes recovery links open the hosted frontend, rather than localhost. See [Gmail setup](gmail-recovery-setup.md).

## 6. Verify the live deployment

1. Check the Render `/health` response and deployment logs, without sharing secret dumps.
2. Open the Netlify homepage and reload a deep link such as `/profile`; it should load the SPA, then apply authentication normally.
3. Sign in with your own active account. Mandatory-change accounts should reach the password-change page. In browser network tools, auth requests should use the Netlify `/api/v1/auth/` path; profile/content calls should use Render.
4. Verify the refresh cookie on the Netlify origin is HttpOnly/Secure with path `/api/v1/auth`. Confirm refresh and logout work after a page reload. Do not copy cookie/token values into reports.
5. Check a permitted photo/document, an upload, and marketplace chat. Verify Socket.IO connects to Render, not Netlify.
6. Deliberately request recovery for your own account and verify receipt; no automatic test emails are sent as part of these setup scripts.
7. Review scheduled-notice timing if using a sleeping/free backend. Upgrade to an always-on instance before requiring timely background publication.

## UptimeRobot

The public `/health` endpoint already exists and is configured as Render's health-check path. Add an HTTP(S) monitor in your own UptimeRobot account using the actual `https://YOUR-API.onrender.com/health` URL. GET and HEAD work without credentials. Healthy server/database returns 200, database failure returns 503, and `Cache-Control: no-store` prevents stale health responses. A five-minute interval is appropriate for a demo monitor; select your own notification contacts. Monitoring does not guarantee continuous free-tier availability through Render restarts or platform maintenance.

## Official references

- [Render Node deployment](https://render.com/docs/deploy-node-express-app), [Blueprint fields](https://render.com/docs/blueprint-spec), [port binding](https://render.com/docs/web-services#port-binding), [free-plan limitations](https://render.com/docs/free)
- [Netlify Vite](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/), [monorepo directories](https://docs.netlify.com/build/configure-builds/monorepos/), [rewrites/proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/)
