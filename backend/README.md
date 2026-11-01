# INCA backend

NestJS REST API and marketplace Socket.IO gateway for INCA. PostgreSQL persistence uses Prisma; files use Cloudflare R2; AI-assisted workflows use Google Gemini.

[Project overview](../README.md) · [Frontend guide](../frontend/README.md) · [Demo walkthrough](../docs/demo.md)

## Setup

Use Node.js 22.12 or newer satisfying the repository package engines, npm, and a dedicated PostgreSQL development database. Run commands from `backend/`.

```sh
npm ci
```

Copy `.env.example` to `.env` only if a local file does not already exist, then configure the variables below. Never overwrite an existing environment file or commit secrets.

```sh
npx --no-install prisma generate
npx --no-install prisma validate
```

### Database preparation

[schema.prisma](prisma/schema.prisma) defines the current data model. It references both `DATABASE_URL` and `DIRECT_URL`. Point them at the same development database; use the unpooled connection for `DIRECT_URL` where your provider supplies one. The `.env.example` currently shows that variable commented out; configure it before Prisma CLI work.

**Migration history is incomplete for some current modules.** Do not assume applying all checked-in migrations creates every table in the current schema, and do not reset or force-push a shared database to compensate.

Choose the path appropriate to your environment:

- **Existing project development database:** verify its schema and migration state with `prisma migrate status` and the project owner. Use the matching schema and generate the client; review any missing changes individually.
- **New, empty, disposable development database:** after confirming both connection URLs refer to that empty database, `npx --no-install prisma db push` can create tables from the current schema. This is a development bootstrap, not a production migration baseline. Do not add `--force-reset` or `--accept-data-loss`.
- **Production/shared environment:** establish a reviewed baseline and apply only reviewed migrations through the deployment process. Do not use `db push` as the production upgrade strategy.

Optional isolated-development role/bootstrap seeding:

```sh
npx --no-install prisma db seed
```

Review [prisma/seed.ts](prisma/seed.ts) first: it upserts roles and a SUPER_ADMIN using a fixed development credential. It is not a secure production account-provisioning process. Do not publish those credentials or run the seed against an unintended database. Accounts and role-specific profiles are separate records; a login alone does not establish student enrollment or a faculty profile.

Start the configured API:

```sh
npm run start:dev
```

Default API: [http://localhost:3000/api/v1](http://localhost:3000/api/v1). Interactive OpenAPI: [http://localhost:3000/docs](http://localhost:3000/docs). Database health: [http://localhost:3000/health](http://localhost:3000/health).

## Environment configuration

Keep values private. Names below are read from source or the Prisma datasource, not copied from a local secret file.

| Variable | Requirement / behavior |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL runtime connection URL |
| `DIRECT_URL` | Prisma datasource's direct database connection URL; configure for CLI operations |
| `JWT_SECRET` | Required JWT signing/verification secret; use a securely generated deployment-specific value |
| `FRONTEND_URL` | Exact allowed frontend origin for HTTP CORS; local example: `http://localhost:5173` |
| `PORT` | HTTP port; defaults to `3000` |
| `NODE_ENV` | Set to `production` in production; affects diagnostics and development request seeding |
| `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY`, `R2_SECRET_KEY` | All needed for R2-backed storage operations. Strict storage has no local-disk fallback |
| `GEMINI_API_KEY` | Enables external AI calls. Without it, some services use fallbacks or report unavailable AI functionality; do not expect equivalent extraction/generation behavior |
| `GEMINI_MODEL` | Optional model override. Timetable extraction and notice enrichment default to `gemini-3.1-flash-lite`; tutor, quiz, and lost/found matching default to `gemini-3.6-flash`. Availability depends on the provider/account |
| `DB_MAX_RETRIES` | Startup database retries; default `5` |
| `DB_CONNECTION_LIMIT`, `DB_CONNECT_TIMEOUT`, `DB_POOL_TIMEOUT` | Runtime connection defaults: `10`, `15` seconds, `20` seconds, unless URL parameters already supply them |
| `PRISMA_LOG_QUERIES` | Enables detailed query diagnostics when `true` |
| `PRISMA_LOG_FULL_SQL` | Enables full SQL diagnostics only outside production; keep off with sensitive data |
| `PRISMA_SLOW_QUERY_THRESHOLD_MS` | Slow-query diagnostic threshold; default `1000` ms |
| `SLOW_REQUEST_THRESHOLD_MS` | Slow HTTP-request threshold; default `1000` ms |

Access tokens expire after 15 minutes. Opaque refresh tokens rotate through an HttpOnly cookie and are stored only as hashes. `JWT_REFRESH_SECRET` is a legacy unused variable. Configure `PASSWORD_MAIL_API_URL`, `PASSWORD_MAIL_API_KEY`, and `FRONTEND_URL` for recovery email. `AUTH_COOKIE_SAME_SITE` defaults to `lax`; use `none` only for a cross-site HTTPS deployment with `NODE_ENV=production`. See [account and profile lifecycle](../docs/account-profile.md) for migration, API, approval policy, and email adapter details.

## Modules and API entry points

Routes below are under `/api/v1` unless marked otherwise. Use running Swagger documentation for exact methods, request DTOs, and schemas; response envelopes vary by module.

| Route family | Source / responsibilities |
| --- | --- |
| `/auth` | Login, current identity, role-constrained account management |
| `/super-admin` | Institution administration; SUPER_ADMIN-only controller |
| `/academic/departments` | Academic hierarchy and related master data |
| `/students`, `/faculty` | Accounts, profiles, student photos, and academic identity |
| `/schedule-templates`, `/schedules`, `/schedule-exceptions` | Recurring templates, dated schedules, cancellations/rescheduling |
| `/admin/timetable-imports` | PDF uploads, extraction, draft slots, conflict review, approval, and active versions |
| `/attendance/sessions` | Session lifecycle and server-provided roster |
| `/attendance` | Record submission and audit corrections |
| `/reports` | Attendance reporting |
| `/activities` | Activity types and faculty-organised events |
| `/requests` | Campus requests |
| `/notes` | Learning materials, document preview, tutor, quizzes, history |
| `/marketplace` | Listings, chat-related REST operations, offers, transactions, reviews, reports |
| `/lost-found` | Reports, AI matches, claims, and handover verification |
| `/notices` | Publishing, feeds, attachments, reads, acknowledgements, notifications |
| `/polls` | Polls and transactional voting |
| `/storage`, `/marketplace/images` | Restricted public raster-image delivery; version-neutral aliases also exist |
| `/health`, `/health/diagnostics` | Unversioned database health and diagnostic telemetry |

Marketplace real-time messaging uses the Socket.IO `/marketplace` namespace on the API origin. It is separate from the REST URL prefix; proxies must support its transports.

`GET /api/v1/students/academic/notices` adapts the first ten active recipient-feed items from `NoticesService` into the dashboard's `data` array (`id`, `title`, `body`, `date`, `author`, priority/read/acknowledgement metadata, and attachment count). It uses the authenticated recipient and the notice board's audience, publication, expiry, archive, and ordering rules. It does not record reads; the shared notice-detail endpoint does so when opened.

### Request and authorization flow

Request → JWT/role guards → controller/validated DTO → service domain checks → repository/Prisma → PostgreSQL or integration → response. [src/main.ts](src/main.ts) configures the URI version, global validation, CORS, exception filter, and Swagger.

Use `Authorization: Bearer <access-token>` for protected HTTP calls. JWT validation reloads the account and role from the database, rejects inactive/deleted accounts or inactive roles, and uses current role information rather than trusting a stale token claim. The frontend's route guards do not replace these checks.

Roles: SUPER_ADMIN, ADMIN, HOD, FACULTY, COORDINATOR, STUDENT. Inspect each controller/service for its exact permissions. Key policies:

- Schedule creation, generation, updates, template changes, and exception changes require ADMIN department scope.
- Faculty manage their own activities; admins manage organisers within their assigned department. Shared activity types are ADMIN-managed.
- Faculty attendance is scoped to their permitted sessions; ADMIN/HOD scope is departmental. COORDINATOR attendance oversight is campus-wide, while SUPER_ADMIN attendance access is read-only.
- Lecture rosters use explicit student section enrollment; activities currently have no section-specific participant model.
- Activity/template deletion cannot erase attendance history through the protected endpoints.
- Tutor/quiz calls require the caller's own student profile; note creation requires their own faculty profile. Admin library management does not borrow someone else's faculty identity.
- Notice recipient access checks publication, audience, expiry, and archival state. Authors and permitted department admins retain privileged document preview. Scheduled publication runs every 30 seconds with startup catch-up and holds unapproved faculty schedules for review.

### Notice approval workflow

FACULTY/HOD notices require review by an ADMIN assigned to the notice's department or a SUPER_ADMIN. ADMIN/SUPER_ADMIN authors can publish their own notices directly. Reviewers cannot approve or reject their own submissions. Department ADMIN scope comes from AdminProfile, not a client-supplied department.

| Endpoint under `/api/v1/notices` | Permission and behavior |
| --- | --- |
| `GET /management/review-queue` | ADMIN sees their department's pending notices; SUPER_ADMIN sees the global queue. Both exclude their own submissions |
| `POST /:id/submit` | Author submits a draft, rejected, or withdrawn notice; body: `{ "expectedUpdatedAt": "<ISO revision from the saved notice>" }` |
| `POST /:id/approve` | Reviewer approves exactly the observed pending revision; same revision body |
| `POST /:id/reject` | Reviewer rejects that revision; body also requires `reason` (3–2000 characters) |

States progress from `DRAFT` to `PENDING_REVIEW`, then to `PUBLISHED` or `SCHEDULED` on approval, or `REJECTED` with feedback. Rejected notices can be edited and resubmitted. Approval records `approvedById` and `approvedAt`; rejection records a reason. Withdrawal reasons belong in the withdrawal audit, not in rejection metadata. Approval/rejection, audit records, and author notifications are transactional; immediate approval also creates recipient notifications in that transaction. Future approvals notify recipients only when the scheduler publishes them.

Edits and attachment changes invalidate prior approval for faculty/HOD notices. Reviewer actions require the observed `updatedAt` revision; concurrent changes return 409. `PUT /:id` optionally accepts `expectedUpdatedAt` for editor conflict detection. Review fields, rejection feedback, archival flags, and terminal review states cannot be supplied through ordinary create/update DTOs. Reviewed/submitted notices must be archived instead of hard-deleted, retaining their audit history.

The existing `status` column is a string and the approval fields already exist, so this workflow needs no schema migration. Existing published notices remain available; future edits apply the new policy. Older scheduled faculty/HOD notices lacking a valid approval are held in `PENDING_REVIEW` when the scheduler next encounters them. The backend does not retroactively fabricate approval records.

## Commands and validation

### Notice AI enrichment

Creating a notice generates a summary, deadlines, action items, key highlights, and tags from its title and body through the existing Gemini SDK. Title/body edits regenerate those fields; metadata-only changes preserve them. An explicitly supplied `aiSummary` takes precedence over the generated summary. Attachments are not sent through this enrichment path.

Enrichment is bounded to 12 seconds and skips bodies over 40,000 characters or titles over 500 characters rather than summarizing a truncated source. Missing credentials, provider errors, timeouts, or invalid responses do not prevent saving the notice. On a text edit, failed generation clears previous enrichment so stale instructions are not displayed. Deadlines must retain the date wording and an exact quotation from the source. The original notice remains authoritative.

These fields already exist in the schema; no new migration or automatic backfill is required. Existing records are enriched when their title/body changes. If another edit wins while AI is running, the save returns 409 rather than attaching generated details to a different revision. Live generation requires a valid `GEMINI_API_KEY` and a model available to that account.

### Project commands

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Development/watch server |
| `npm run build` | Compile using Nest CLI |
| `npm run start:prod` | Run compiled `dist/main` |
| `npm test -- --runInBand` | Run Jest unit/regression suites serially |
| `npm run test:cov` | Coverage run |
| `npm run test:e2e` | Separate e2e configuration; inspect its database requirements first |
| `node node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit --incremental false --declaration false` | Typecheck without build output |

`npm run lint` includes `--fix`, and `npm run format` rewrites source. Use `npx --no-install eslint "{src,apps,libs,test}/**/*.ts"` for a non-fixing lint pass. Unit/regression suites mock integrations; passing them does not verify live Gemini, R2, or a deployed database.

## Deployment and operational behavior

Build the backend, supply private production environment values, and run the production entry point. Provision a PostgreSQL schema matching the application before startup. Use HTTPS, configure frontend CORS, and allow Socket.IO traffic when marketplace chat is required. Static frontend hosting cannot run this server or its database.

Startup connects to PostgreSQL with retries and may perform work: the notice publisher can publish due notices and create notifications. Outside production, the requests module can insert development sample requests into an empty request table. Do not start the app against production just to capture screenshots. Use a separate database and synthetic data for demonstrations.

Health returns 503 when the database is unreachable. Missing R2 credentials fail file operations even if login and metadata endpoints work. Capture integration failures through application logs without sharing environment contents, tokens, or full SQL containing personal data.

Existing migration reproducibility and legacy bootstrap credentials remain deployment considerations; this documentation update does not alter schema, seed behavior, or production data.
