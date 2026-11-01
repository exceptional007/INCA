# Account security and approved profiles

## Database rollout

The additive migration `backend/prisma/migrations/20261031183000_auth_profile_lifecycle/migration.sql` adds refresh sessions, recovery credentials, rate-limit buckets, profile requests, and generic profile fields for accounts without a student/faculty profile. Apply migrations to the intended environment with the existing Prisma deployment workflow and regenerate the Prisma client before starting the updated backend. Back up the production database using the deployment's normal procedure. This work does not apply migrations to the project's configured database.

Existing JWTs lack session IDs and will require sign-in again. Initial passwords can authenticate only to the restricted password-change flow. The backend, rather than just the route guard, enforces that restriction. Changing or resetting a password revokes all devices. Administrative password replacements require another first-login change.

The database `users_auth_version` trigger increments the account security version whenever password, email, role assignment, active state, or mandatory-change state changes. Every authenticated request and refresh compares the current version with the session version. Suspension followed by reactivation therefore cannot resurrect an old session. Preserve this trigger, the partial `profile_one_pending_per_user` index, and profile status/self-review checks in future migrations: Prisma's schema does not fully express these database objects.

## Refresh, revocation, and recovery

- Access tokens last 15 minutes. Refresh sessions last seven days and rotate on use. Replaying a rotated token revokes the entire session family. Logout revokes that family; all-device logout revokes every family belonging to the user.
- The refresh cookie is HttpOnly, scoped to `/api/v1/auth`, and Secure in production. `FRONTEND_URL` must be the exact frontend origin, without a trailing slash or path. Cookie mutation endpoints reject untrusted origins. Cross-site frontend/API hosts require HTTPS, `NODE_ENV=production`, and `AUTH_COOKIE_SAME_SITE=none`; browser third-party cookie policies can still block such deployments. A same-site deployment avoids that limitation.
- The frontend sends credentials, coalesces refreshes within a tab, and uses Web Locks to coordinate refreshes across supported browser tabs. Access tokens retain compatibility with existing bearer-token consumers; refresh secrets are never returned to browser JavaScript or stored in localStorage. Signing out clears cached account data.
- Marketplace WebSockets validate the same session identity at connection, incoming events, and before outgoing delivery. Revoked, restricted, expired, or inactive accounts cannot keep receiving messages through an old connection. The frontend reconnects chat and rejoins the active conversation when access credentials rotate.
- Passwords must be 12–72 characters, at most 72 UTF-8 bytes, with uppercase, lowercase, and a number. Current-password verification is required for authenticated changes; reusing the current password is rejected.
- Recovery links contain a cryptographically random, single-use token in the URL fragment. Only its SHA-256 hash and credential-at-issue hash are stored. The frontend removes the fragment from the address bar after opening the reset form. Links expire in 20 minutes and are invalidated after another password change/reset.
- Recovery responds identically for existing and missing accounts. Email delivery runs asynchronously so provider latency does not disclose account existence; graceful shutdown drains in-flight deliveries. Failed delivery invalidates that token and logs a message without its contents. A hard process crash can lose an in-flight delivery; users can request a new link. Rate limits persist across backend processes in PostgreSQL.
- Cleanup runs hourly while the backend runs. Expired rate buckets are removed; expired reset credentials are retained seven days and expired sessions thirty days before deletion, preserving replay detection for active families.

## Recovery email adapter

For Gmail without a sending domain, follow [Gmail recovery setup](gmail-recovery-setup.md). `PASSWORD_MAIL_PROVIDER=google-apps-script` validates Google's deployed `/exec` URL, authenticates in the JSON body, and requires a successful JSON acknowledgement. A Google mail-sending error is not mistaken for a successful HTTP 200 response.

For an existing gateway, leave `PASSWORD_MAIL_PROVIDER=gateway` (default). Set `PASSWORD_MAIL_API_URL` to your HTTPS email gateway and `PASSWORD_MAIL_API_KEY` to its bearer credential. Configure the gateway's sender/domain with your email provider. This adapter expects the following contract; it is not a provider-specific SMTP client:

```http
POST <PASSWORD_MAIL_API_URL>
Authorization: Bearer <PASSWORD_MAIL_API_KEY>
Content-Type: application/json

{"to":"recipient@bit.ac.in","subject":"Reset your INCA password","text":"...single-use recovery URL..."}
```

The generic gateway must accept mail only for the authorized application, deliver the supplied plain text, avoid logging recovery links, and return a 2xx response within ten seconds. Google mode allows twenty seconds. Non-2xx/timeouts are delivery failures. The adapter follows no client-supplied URLs. Missing configuration returns 503; tokens are never printed or returned as a development shortcut. No real recovery emails were sent during automated validation.

## Profile permissions and behavior

Every role has `/profile`, reachable from the sidebar, account menu, or feature-hub account menu. The page contains personal and campus records, update history, security/session controls, and an approval inbox for reviewers. Students/faculty use their existing profile models; admins, super admins, and coordinators also have a profile even when they have no faculty/student record.

Personal names, phone, gender/date of birth, and applicable student address/emergency/blood-group details can be proposed. Academic identifiers, designation, department, email, role, and account status remain administrative fields. Photos can be submitted independently or with detail changes. A request is immutable, with at most one pending request per account; cancel or await a decision before submitting another. Rejected requests show feedback and allow a corrected new request.

| Request owner | Reviewers |
| --- | --- |
| Student or faculty | Same-department HOD or ADMIN; any SUPER_ADMIN |
| HOD | Same-department ADMIN; any SUPER_ADMIN |
| Coordinator | Department ADMIN when assigned; ADMIN when no academic department is assigned; any SUPER_ADMIN |
| ADMIN or SUPER_ADMIN | Another SUPER_ADMIN |

Self-review is always blocked. A deployment with only one super admin needs another authorized super admin to approve that account's own profile request. No self-approval exception is built in.

Submissions retain a snapshot of current details. Approval checks that snapshot against the live record and rechecks reviewer scope, then atomically applies approved fields, records reviewer/date/status, and sends an in-app notification. Concurrent or stale requests cannot overwrite later administrative corrections. Rejection leaves the profile unchanged and records required feedback. History is retained; the UI shows the latest 50 requests and up to 100 pending inbox entries at a time.

Proposed photos use the private `profile-requests/` namespace, rejected by existing public image routes. Only the owner and authorized reviewers can preview them. Accepted types are PNG/JPEG/WebP up to 5 MB, checked by file signature. Approval copies the image to the existing public-image namespace and updates the relevant photo pointers. Failed database writes clean up newly uploaded/promoted objects; original request photos remain available for history. The R2 bucket must remain private behind the existing application routes. Existing storage credentials/configuration are reused.

## API reference

Paths below are under `/api/v1`. Password/profile mutations use POST unless shown otherwise. Normal DTO validation rejects extra properties.

| Endpoint | Purpose / input |
| --- | --- |
| `auth/login` | Institutional email/password; returns access token and safe user, sets refresh cookie |
| `auth/refresh` | Cookie rotation; safe token/user response |
| `auth/logout` | Cookie-based session-family revocation and cookie clearing |
| `auth/forgot-password` | `{ email }`; generic recovery response |
| `auth/reset-password` | `{ token, newPassword }`; consumes recovery link, revokes devices |
| `auth/change-password` | Bearer authentication; `{ currentPassword, newPassword }`; available to restricted first-login sessions |
| `GET auth/me` | Current safe identity and mandatory-change state |
| `GET auth/sessions` | Current user's active sessions, dates, current-session marker; no secret/hash values |
| `DELETE auth/sessions/:id` | Owner-only family revocation |
| `auth/logout-all` | Revoke all sessions |
| `GET profile` | Safe personal/campus details, editable field list, revision digest |
| `GET profile/requests` | Own request history |
| `profile/requests` | Multipart: `changes` JSON string, `revision` digest, optional `photo` file |
| `GET profile/review-queue` | Scoped pending request inbox |
| `profile/requests/:id/approve` | Approve immutable submitted revision |
| `profile/requests/:id/reject` | `{ reason }`, 3–2000 characters |
| `profile/requests/:id/cancel` | Owner-only cancellation of pending request |
| `GET profile/photo` | Authenticated own current photo |
| `GET profile/requests/:id/photo` | Owner/reviewer-only proposed photo |

## Validation

`auth-profile-lifecycle.spec.ts` exercises actual controllers, DTOs, JWT strategy, and services with transactional database doubles and mocked mail/R2. `backend/test/auth-profile-db.ts` verifies row locking, JSONB snapshots, trigger invalidation, unique/check constraints, and password revocation on a disposable PostgreSQL instance at the fixed loopback test URL. It never reads the project database URL. `backend/test/auth-profile-ui-server.ts` and `auth-profile-browser.cjs` are localhost-only synthetic browser fixtures; they are excluded from production compilation. They require the disposable database and test ports documented in their headers and must never be exposed publicly.
