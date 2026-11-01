# Gmail recovery email setup

This connects INCA's HTTP email adapter to Gmail/Google Workspace through a recovery-only Google Apps Script web app. No custom domain, Gmail password, or new npm dependency is required. The account owner must authorize/deploy the Google script. A school-managed account may prohibit public web apps; use an authorized personal Gmail account if necessary.

## Already prepared locally

- The auth/profile migration was applied to the configured Supabase database on 1 November 2026. Existing user count was unchanged. The new tables have RLS and no browser-role Data API grants. The security trigger and pending-request unique index were verified through the runtime connection.
- A schema-only snapshot and rollout logs are in Git-ignored `backend/.tmp/auth-profile-rollout/`.
- Ignored `backend/.env` contains `PASSWORD_MAIL_PROVIDER=google-apps-script`, a generated `PASSWORD_MAIL_API_KEY`, and the deployed gateway URL. The secret is not committed or displayed in chat. On 1 November 2026, the deployed gateway passed the authenticated connection/quota check; no email was sent. Restart the backend to load these settings. Actual email receipt still needs a deliberate test using your own account.
- [Code.gs](../ops/google-apps-script/Code.gs) is the paste-ready source. It checks the shared secret and recipients, constructs only recovery messages, and reports delivery errors. It does not read your Gmail inbox.

## 1. Deploy your Google gateway

1. Open [Google Apps Script](https://script.google.com/home/start) with the sending account. Create a project named **INCA Recovery Mail**.
2. Replace default `Code.gs` with [this gateway source](../ops/google-apps-script/Code.gs), then save. No credentials belong in the source file.
3. Under **Project Settings → Script Properties**, add:

   | Property | Value |
   | --- | --- |
   | `INCA_MAIL_API_KEY` | Copy `PASSWORD_MAIL_API_KEY` from local `backend/.env` |
   | `INCA_FRONTEND_URL` | Copy `FRONTEND_URL` from `backend/.env`; use the actual HTTPS frontend origin when deployed |
   | `INCA_RECIPIENT_DOMAIN` | `bit.ac.in`, matching institutional login policy |
   | `INCA_TEST_RECIPIENT` | Optional: your own exact Gmail address for a deliberately requested test email |

4. Select **Deploy → New deployment → Web app**, **Execute as: Me**, **Who has access: Anyone**. The shared secret protects POST requests; public Google access is needed because your backend is not signed into Google.
5. Authorize mail sending from your own account, reviewing that this is the project/code you created. The script uses `MailApp`, without permission to read messages.
6. Copy its **Web app URL**: `https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec`. Use `/exec`, not `/dev`. Never put the shared secret in the URL.

Google documents [web-app deployment](https://developers.google.com/apps-script/guides/web) and [MailApp](https://developers.google.com/apps-script/reference/mail/mail-app).

## 2. Connect INCA

Set the URL in ignored `backend/.env`; keep the existing key and actual frontend origin:

```dotenv
PASSWORD_MAIL_PROVIDER=google-apps-script
PASSWORD_MAIL_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
PASSWORD_MAIL_API_KEY=<existing generated local secret>
FRONTEND_URL=http://localhost:5173
```

The frontend origin above is an example. It must match `INCA_FRONTEND_URL`. Do not overwrite unrelated settings.

From `backend` run:

```powershell
node scripts/check-recovery-email.cjs
node scripts/check-recovery-email.cjs --check
```

The first command lists missing settings without showing secrets. The second authenticates and checks quota **without sending email**. Success: `Google gateway authenticated; sending quota available. No email sent.`

Restart the backend after configuration changes. Copy these settings to your backend hosting environment/secrets manager for deployment: local `.env` does not configure a hosted server. Set `NODE_ENV=production`, the actual HTTPS `FRONTEND_URL`, and cookie settings described in [account deployment](account-profile.md).

## 3. Deliberately verify delivery

After the connection check succeeds, use **Forgot your password?** with your own existing active INCA account. Check Inbox/Spam, open the link, set a password, and verify old credentials/sessions fail. A recovery request alone does not change a password. Do not test using another person's address.

The API returns a generic response for existing and missing accounts, so that response does not prove delivery. Confirm receipt before considering setup complete. An optional external Gmail test recipient does not bypass institutional login policy or create an INCA account.

## Operations

- Google's [daily sending quotas](https://developers.google.com/apps-script/guides/services/quotas) apply. This suits low-volume project use; verify capacity before campus-wide deployment.
- Google mode allows twenty seconds per request. [Content Service](https://developers.google.com/apps-script/guides/content) redirects its JSON response to Google-hosted content; the adapter follows that response redirect.
- Code edits require deploying a new version; keep the same active deployment URL. Script Property changes do not require embedding secrets in source.
- If checks fail, verify **Anyone** access, `/exec`, matching keys/origins, authorization, and quota. Do not share logs with keys or recovery links.
- Rotate a compromised key in both backend secrets and Google Script Properties. Never put it in a `VITE_` variable or commit it.
- Existing bearer-authenticated gateways still work with `PASSWORD_MAIL_PROVIDER=gateway`; see [the original gateway contract](account-profile.md#recovery-email-adapter).
