# INCA frontend

React single-page client for INCA's public website, role-based campus portals, and domain workflows. The API is a separate [NestJS application](../backend/README.md).

[Project overview](../README.md) · [Demo walkthrough](../docs/demo.md) · [Screenshots](../docs/screenshots/README.md)

## Setup

Use Node.js 22.12 or newer satisfying the package engines. Run commands from `frontend/`.

```sh
npm ci
npm run dev
```

The development server uses port **5173**. If the port is occupied, Vite may choose another port; keep the backend's `FRONTEND_URL` consistent with the actual browser origin.

No environment file is required for the default local API. To override it, create `frontend/.env`:

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
```

`VITE_` values are bundled into browser code and are public. Never put database credentials, JWT signing secrets, R2 secrets, or Gemini keys here. Restart Vite after environment changes and rebuild for deployed changes.

The landing page (`/`) and sign-in screen (`/login`) render without a backend. Protected local workflows require the backend and a prepared development database. The [deployed login page](https://inca-campus-portal.netlify.app/login) lists owner-approved public demo accounts; those are separate from local database provisioning. Backend authorization applies to every protected workflow.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | TypeScript project build followed by Vite production bundling into `dist/` |
| `npm run preview` | Preview built assets on port 4173; not a production server |
| `npm run lint` | Oxlint checks |
| `node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --incremental false` | Application typecheck without build artifacts |

There is currently no frontend test runner/script. Do not interpret a successful build as a browser workflow test.

## Routes

Routes are declared in [src/App.tsx](src/App.tsx). Pages load lazily inside React Suspense.

| Route | Screen / access |
| --- | --- |
| `/` | Public landing page |
| `/login` | Public sign-in screen |
| `/hub` | Authenticated module selector |
| `/dashboard` | Dashboard selected for the current role |
| `/schedules` | Timetables and dated schedules |
| `/activities` | Campus activities |
| `/attendance/mark` | Attendance workflow; FACULTY, HOD, COORDINATOR, ADMIN |
| `/attendance/objections` | Attendance-objection review; ADMIN campus-wide, HOD department-scoped |
| `/reports` | Attendance reports |
| `/academic` | Academic master data; SUPER_ADMIN, ADMIN, HOD |
| `/academic/timetable-imports` | Redirect to `/schedules?tab=import` |
| `/notes` | Notes library, tutor, quizzes, and attempt history |
| `/marketplace` | Listings and campus trading workflows |
| `/lost-found` | Reports, matching, claims, handover verification |
| `/notices` | Notice board and management views |
| `/polls` | Campus polls |

Routes without a narrower role restriction above still require authentication. Individual controls and backend endpoints impose additional role/profile requirements. Green Credits is an inactive hub card, not a working route.

## Code map and data flow

- [src/App.tsx](src/App.tsx): routes and shared TanStack Query client.
- [src/context/AuthContext.tsx](src/context/AuthContext.tsx): authentication state; stores `inca_token` and `inca_user` in localStorage.
- [src/components/auth/ProtectedRoute.tsx](src/components/auth/ProtectedRoute.tsx): client navigation restrictions.
- [src/api/axios.ts](src/api/axios.ts): API base, bearer token attachment, and 401 handling. A 401 clears local authentication and redirects to sign-in.
- `src/services/`: domain API calls; marketplace Socket.IO client uses the `/marketplace` namespace on the backend origin derived from `VITE_API_URL`.
- `src/pages/`: domain screens and role-specific dashboards.
- `src/components/ui/`: shared Radix-based components; styles use Tailwind CSS.
- [src/components/useInitialCredentials.tsx](src/components/useInitialCredentials.tsx): unique password generation and a creation-only credential dialog. Credentials are not persisted by this helper.

User action → page/service → Axios → NestJS endpoint → response → page/query state. Backend checks remain authoritative even if a client route is visible. Attendance lists use current schedules and server-provided rosters; missing current schedules do not create demo sessions.

The student dashboard's notices tab previews the first ten items from the same targeted, published feed as the notice board through `/students/academic/notices`. Opening a notice loads the shared detail dialog; listing previews does not mark them as read. Use “View all notices” for the complete board.

The shared notice-detail dialog also displays generated summaries, source-backed deadlines, action items, highlights, and tags when available. Generation happens on the backend when a notice is created or its title/body changes. The original announcement is always shown, and missing AI enrichment does not prevent publication.

Notice management includes draft editing, submission for approval, rejection feedback, and resubmission. FACULTY/HOD publishers use “Submit for Approval”; ADMIN/SUPER_ADMIN publishers can publish directly. Reviewers use “Approval Queue” to preview documents and approve or reject the observed revision. The server supplies permitted actions and enforces department scope and no self-approval. Changes to reviewed text, targeting, schedules, or attachments require another review. A stale decision shows an error; refresh the queue before reviewing again. Review history is retained through archival.

Every role has a responsive `/profile` page with personal/campus details, proposed detail/photo updates, review history, a scoped approval inbox for HOD/admin reviewers, password changes, and active-session revocation. Initial-password accounts are directed to `/change-password`; public recovery screens are `/forgot-password` and `/reset-password`. Requests use credentialed HTTP with automatic refresh-cookie rotation. See [account and profile configuration](../docs/account-profile.md) and [actual desktop/mobile captures](../docs/screenshots/README.md).

The Vite `@` alias maps to `src/`. A development `/api` proxy exists, but the default Axios URL is absolute; it does not use that proxy unless configured to a relative API URL. The marketplace socket client expects an absolute backend API URL for deriving its socket origin.

## Build and hosting

```sh
npm ci
npm run build
npm run preview
```

Set the deployed `VITE_API_URL` before `npm run build`. Serve `dist/` over HTTPS and configure client-route fallback to `index.html`. The host must reach the separate backend; it also needs to permit marketplace Socket.IO connections. Configure `FRONTEND_URL` on the backend to the exact deployed origin.

## Troubleshooting

- **Public pages work but login fails:** verify the backend base URL, `/health`, database connectivity, and active account/role. Static frontend hosting alone does not provide an API.
- **CORS error:** match `FRONTEND_URL` to the current frontend origin, including scheme and port.
- **Unexpected sign-out:** expired or rejected JWTs produce a 401; account deactivation and current database role checks can reject an existing token.
- **Tutor/quiz returns 403:** the account needs its own student profile. The application no longer borrows another student's identity.
- **Note creation returns 403:** the caller needs their own faculty profile. Admin library management does not create a faculty identity.
- **No classes today:** check the date, current timetable, and explicit student section enrollment; the page intentionally does not fall back to unrelated schedules.
- **A deployed deep link returns 404:** add the SPA rewrite to `index.html` at the static host.

For actual screenshots and capture constraints, see [the screenshot guide](../docs/screenshots/README.md).
