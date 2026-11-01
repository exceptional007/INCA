# INCA screenshot gallery

These are real browser captures of the local frontend. Public-page captures were taken on 31 October 2026 at 1440 × 1000 CSS pixels; profile captures used synthetic accounts on 1 November 2026 at the sizes listed below. Capture used the installed Microsoft Edge in headless mode with an isolated browser profile. Images were checked after rendering and animation completion; no generated mockups are presented as application screenshots.

| Image | Route | Account / dataset |
| --- | --- | --- |
| [Landing page](landing-page.png) | `/` | Public; no account or backend connection |
| [Sign-in page](login.png) | `/login` | Public; fields empty, no credentials entered |
| [Profile desktop](profile-demo.png) | `/profile` | Synthetic STUDENT, disposable local PostgreSQL; 1440 × 1100; 1 November 2026 |
| [Profile mobile](profile-mobile-demo.png) | `/profile` | Same synthetic STUDENT; 390 × 844; 1 November 2026 |

![INCA landing page](landing-page.png)

![INCA sign-in page](login.png)

## Capture checklist

1. Run the current frontend against an isolated development backend/database if authenticated pages are needed. Public pages require only the frontend.
2. Use synthetic campus data and a dedicated demo account with the role needed for the screen.
3. Use a consistent viewport and wait for fonts, loading states, and entrance animations to finish.
4. Capture the actual page, not a design mockup. Do not show secrets, OTPs, access tokens, credentials, or identifiable campus records.
5. Save a descriptive PNG filename in this directory. Inspect it at readable size before adding a Markdown reference.
6. Record route, role, dataset, viewport, and capture date in this table. Confirm every referenced file exists.

Authenticated dashboard, feature-hub, timetable review, attendance, master-data, and report captures have not been added. Capture those only with an approved synthetic dataset; the root README does not reference missing images for them.
